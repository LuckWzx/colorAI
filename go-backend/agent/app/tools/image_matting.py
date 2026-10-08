"""image_matting 工具：图片抠图（搭档提供的 MCP 风格 HTTP 接口，独立文件）。

服务：POST {MATTING_MCP_URL}，JSON-RPC 风格但**不需要 initialize / session 握手** ——
直接 {"method":"call_tool","params":{"name":"matting","arguments":{...}}}。
异步任务制：matting 提交 → 返回 task_id；get_task_status 轮询 → completed 后带结果 URL。
**工具内部完成轮询**（对 LLM 屏蔽异步细节，一次调用拿到最终结果）。

四条硬约定（与其它工具形态对齐）：
  1. **绝不 raise**：抠图失败归为 success=false + errorCode；
  2. **错误藏在文本里**（2026-10-08 实测）：任务不存在返回「❌ 任务 ... 不存在」文本，
     而 isError 仍为 false —— 必须解析 text 内容，不能信 isError；
  3. 轮询总上限 MATTING_POLL_TIMEOUT 必须留在 Go 侧 60s 超时之内（含 LLM 总结耗时）；
  4. 不产出卡片（不在 TOOL_TYPE_MAPPING 里 → type=text + metadata=None），
     结果图由 LLM 用 Markdown 图片语法在回复中展示（docstring 已指导 LLM）。

⚠️ 网络可达性 / 已知服务端问题：
  - 服务在局域网（默认 10.10.30.190:8082）：**生产（阿里云）不可达**，仅内网可用；
  - 结果 URL 是相对路径（/files/xxx.png），用 MCP URL 的 scheme://host 拼绝对地址；
  - 传给服务的 image_url 必须是**服务能访问到**的地址（开发时用局域网 IP，不能用 localhost）；
  - **服务端 bug（2026-10-08 实测）**：结果 URL 报 /files/ 而文件实际在 /uploads/ 下
    （/files 路由未暴露，404）—— _resolve_result_url 做 HEAD 探测 + 前缀重写兼容，
    服务端修复后（改返回 /uploads 或挂上 /files 路由）自动恢复直连，无需改回代码。
  - **结果转存（2026-10-08）**：源站结果 URL 是临时内网地址（会过期、外网不可达），
    成功后立即通过 app/utils/oss_store.import_url 转存到自有 OSS（与 go-backend 同配置）；
    转存失败**降级保留临时 URL**（error 日志），不拖垮抠图本身。
"""
from __future__ import annotations

import re
import time
from urllib.parse import urlsplit

import httpx
from langchain_core.tools import tool
from loguru import logger

from app.config import settings
from app.utils.oss_store import import_url


class MattingError(Exception):
    """带 errorCode 的内部异常，用于统一错误出口"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# 实测样本（2026-10-08）：
#   提交成功   → "🎨 抠图任务已提交！\n\n任务ID: <uuid>\n状态: 处理中\n..."
#   查询完成   → "✅ 任务状态查询\n...\n状态: completed\n...\n结果URL: /files/20261008/<uuid>.png"
#   任务不存在 → "❌ 任务 <uuid> 不存在"
_RE_TASK_ID = re.compile(r"任务ID[:：]\s*([0-9a-fA-F-]{8,})")
_RE_STATUS = re.compile(r"状态[:：]\s*([A-Za-z_]+)")
_RE_RESULT_URL = re.compile(r"结果URL[:：]\s*(\S+)")

# 转存到 OSS 的对象键目录前缀（与 go-backend 的上传图同目录约定：聊天资产 → chat/）
_OSS_PREFIX = "chat"


def _mcp_base_url() -> str:
    """从 MATTING_MCP_URL 推导服务根地址（结果相对路径的拼接前缀）"""
    parts = urlsplit(settings.MATTING_MCP_URL)
    return f"{parts.scheme}://{parts.netloc}"


def _absolute_url(path: str) -> str:
    """结果可能是相对路径（/files/...）→ 拼成完整 URL；已是 http(s) 则原样返回"""
    if path.startswith(("http://", "https://")):
        return path
    return _mcp_base_url() + (path if path.startswith("/") else "/" + path)


def _head_ok(url: str) -> bool:
    """HEAD 探测 URL 是否可访问（轻量，不下载内容）"""
    try:
        resp = httpx.head(url, timeout=httpx.Timeout(10.0), follow_redirects=True)
        return resp.status_code < 400
    except Exception:  # noqa: BLE001
        return False


def _resolve_result_url(path: str) -> str:
    """结果路径 → 可访问的完整 URL（含服务端 bug 的兼容重写）。

    ⚠️ 服务端 bug（2026-10-08 实测）：get_task_status 返回「结果URL: /files/...」，
    但文件实际挂在 /uploads/ 下（/files 路由未暴露 → 404）。
    这里做 HEAD 探测：原路径 404 时尝试 /files → /uploads 前缀重写；
    服务端修复后（改返回 /uploads 或挂上 /files 路由）原路径直接 200，自动恢复直连。
    """
    full = _absolute_url(path)
    if _head_ok(full):
        return full

    if "/files/" in path:
        alt = _absolute_url(path.replace("/files/", "/uploads/", 1))
        if _head_ok(alt):
            logger.warning(f"[image_matting] 结果 {path} 404，已重写为 {alt}（服务端 URL 前缀 bug 兼容）")
            return alt

    return full  # 都不可达：返回原始 URL，让用户/LLM 看到真实情况


def _persist_result(temp_url: str) -> str:
    """把临时结果转存到自有 OSS（防过期 + 外网可达），失败降级返回临时 URL。

    降级而非报错的理由：转存失败时抠图本身是成功的，对话不应因此中断；
    但 error 日志必须留痕（外网用户会看不到图，属于需尽快修的异常）。
    """
    if not settings.OSS_ENABLED:
        return temp_url
    try:
        return import_url(_OSS_PREFIX, temp_url)
    except Exception as exc:  # noqa: BLE001 —— 转存失败不能拖垮抠图本身
        logger.error(
            f"[image_matting] 结果转存 OSS 失败，降级保留临时 URL"
            f"（URL 会过期、外网可能看不到图）：{exc}"
        )
        return temp_url


def _call_mcp(tool_name: str, arguments: dict) -> str:
    """调用一次 MCP 风格接口，返回 result.content[0].text

    Raises:
        MattingError: 网络失败 / HTTP 异常 / 响应结构不符合预期
    """
    try:
        resp = httpx.post(
            settings.MATTING_MCP_URL,
            json={
                "jsonrpc": "2.0",
                "method": "call_tool",
                "id": 1,
                "params": {"name": tool_name, "arguments": arguments},
            },
            timeout=httpx.Timeout(settings.MATTING_TIMEOUT),
        )
        resp.raise_for_status()
    except httpx.TimeoutException as exc:
        raise MattingError("SERVICE_TIMEOUT", "抠图服务响应超时") from exc
    except httpx.HTTPStatusError as exc:
        raise MattingError("SERVICE_ERROR", f"抠图服务返回 {exc.response.status_code}") from exc
    except Exception as exc:  # noqa: BLE001
        raise MattingError(
            "SERVICE_UNAVAILABLE",
            f"抠图服务不可达（{settings.MATTING_MCP_URL}，仅内网可用）",
        ) from exc

    try:
        body = resp.json()
        blocks = body["result"]["content"]
        return next(b["text"] for b in blocks if isinstance(b, dict) and b.get("type") == "text")
    except Exception as exc:  # noqa: BLE001
        raise MattingError("PARSE_ERROR", f"抠图服务返回了非预期格式: {exc}") from exc


def _submit_matting(image_url: str, resolution: int | None) -> str:
    """提交抠图任务 → task_id。

    仅对网络类错误重试（重试安全：最坏情况多一个冗余任务，无副作用）；
    解析出「❌」类业务拒绝文案时不再重试，直接带回。
    """
    args: dict = {"image_url": image_url}
    if resolution:
        try:
            args["resolution"] = int(resolution)
        except (TypeError, ValueError):
            logger.debug(f"[image_matting] 忽略非法 resolution={resolution!r}")

    last: MattingError | None = None
    for attempt in range(settings.MATTING_RETRY + 1):
        try:
            text = _call_mcp("matting", args)
        except MattingError as exc:
            last = exc
            if exc.code == "PARSE_ERROR":
                break  # 解析错误重试无意义
            logger.warning(f"[image_matting] 提交第 {attempt + 1} 次失败: {exc.message}")
            continue

        m = _RE_TASK_ID.search(text)
        if m:
            return m.group(1)
        # 业务拒绝（如 ❌ 文案）——不重试
        raise MattingError("SUBMIT_REJECTED", text.strip().splitlines()[0][:120])

    raise last or MattingError("SERVICE_UNAVAILABLE", "抠图服务不可用")


def _wait_for_result(task_id: str) -> str:
    """轮询直到 completed / failed / 超时，返回结果路径（相对或绝对）

    Raises:
        MattingError: TASK_NOT_FOUND / TASK_FAILED / MATTING_TIMEOUT / SERVICE_*
    """
    deadline = time.monotonic() + settings.MATTING_POLL_TIMEOUT
    consecutive_errors = 0

    while time.monotonic() < deadline:
        time.sleep(settings.MATTING_POLL_INTERVAL)
        try:
            text = _call_mcp("get_task_status", {"task_id": task_id})
            consecutive_errors = 0
        except MattingError as exc:
            consecutive_errors += 1
            logger.warning(f"[image_matting] 轮询失败（连续 {consecutive_errors} 次）: {exc.message}")
            if consecutive_errors >= 3:
                raise
            continue

        if "不存在" in text:
            raise MattingError("TASK_NOT_FOUND", text.strip().splitlines()[0][:120])

        m_url = _RE_RESULT_URL.search(text)
        m_status = _RE_STATUS.search(text)
        status = m_status.group(1).lower() if m_status else ""

        # 有结果 URL 即视为完成（比单纯信状态字面量更鲁棒）
        if status == "completed" or m_url:
            if not m_url:
                raise MattingError("PARSE_ERROR", "任务已完成但未解析到结果 URL")
            return m_url.group(1)
        if status in ("failed", "error"):
            raise MattingError("TASK_FAILED", "抠图任务处理失败，请更换图片后重试")

    raise MattingError("MATTING_TIMEOUT", f"抠图处理超时（task_id={task_id}），请稍后重试")


@tool
def image_matting(image_url: str, resolution: int | None = None) -> dict:
    """图片抠图工具（移除背景，输出透明底 PNG）。

    何时使用：用户上传了图片，希望「抠图 / 去背景 / 移除背景 / 生成透明底」时调用。

    重要约定：success=true 时，请在回复中**务必**用 Markdown 图片语法展示结果：
    `![抠图结果](imageUrl)` —— imageUrl 原样使用返回值，不要改写 URL。

    Args:
        image_url: 待抠图的完整图片 URL（由后端在图片落盘后生成），不要传 base64。
        resolution: 可选，输出图片最大边长（像素），不传则使用原图尺寸。

    Returns:
        dict: {success, imageUrl, taskId, elapsedTime}；imageUrl 默认已转存到
              自有 OSS（持久、外网可达），转存失败时降级为源站临时 URL；
              失败时 {success: false, errorCode, error}
    """
    if not settings.MATTING_ENABLED:
        return {"success": False, "errorCode": "DISABLED", "error": "抠图功能未启用"}

    url = (image_url or "").strip()
    if not url:
        return {"success": False, "errorCode": "INVALID_ARGUMENT", "error": "缺少图片 URL"}

    started = time.monotonic()
    try:
        task_id = _submit_matting(url, resolution)
        logger.info(f"[image_matting] 任务已提交 task_id={task_id}")
        result_path = _wait_for_result(task_id)
        image_result_url = _persist_result(_resolve_result_url(result_path))
        elapsed = round(time.monotonic() - started, 1)
        logger.info(f"[image_matting] 完成 elapsed={elapsed}s → {image_result_url}")
        return {"success": True, "imageUrl": image_result_url,
                "taskId": task_id, "elapsedTime": elapsed}
    except MattingError as exc:
        logger.warning(f"[image_matting] 失败 errorCode={exc.code} msg={exc.message}")
        return {"success": False, "errorCode": exc.code, "error": exc.message}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[image_matting] 未预期异常")
        return {"success": False, "errorCode": "INTERNAL_ERROR", "error": f"抠图失败: {exc}"}
