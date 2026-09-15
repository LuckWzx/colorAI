"""
色彩处理工具定义

**只注册已实现的工具**：目前仅 `image_correction`（已对接搭档真实校色接口，
见 doc/图片校色Tool封装设计.md）。

其余 4 个能力（取色 / 对比 / 转换 / 手机校色）尚未实现，**故意不注册** ——
原因与契约见文件末尾的说明块。注册未实现的工具会让 LLM 返回编造的数据。
"""

import httpx
from langchain_core.tools import tool
from loguru import logger
from typing import Optional

from app.config import settings


# ---------------------------------------------------------------------------
# 图片校色 image_correction
#
# 对接搭档提供的校色接口，接口细节见 doc/Color_Correction.md，
# 封装设计见 doc/图片校色Tool封装设计.md。三条关键约定：
#
#   1. 入参是「完整图片 URL」，不是 base64。
#      tool 的参数由 LLM 生成（文本 token），几 MB 的 base64 不可能被 LLM 原样复述；
#      URL 只有几十字符，可以。图片字节由 tool 自己去下载。
#   2. `passed=false` 是正常业务分支（拍摄环境不达标），接口仍返回 HTTP 200，
#      所以不能当异常处理 —— 归一化成 `success: true` + `passed: false`，
#      否则 Agent 的 _extract_tool_result 会把结果丢掉、退化成纯文本回复。
#   3. 返回 `dict` 即可：LangGraph 的 ToolNode 会对非字符串返回值做
#      json.dumps(..., ensure_ascii=False)，ToolMessage.content 因此仍是合法 JSON。
# ---------------------------------------------------------------------------


class CorrectionError(Exception):
    """带 errorCode 的内部异常，用于统一错误出口"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _extract_api_error(resp: httpx.Response) -> str:
    """校色接口的错误体形如 {"error":"未上传图片"}，尽力把文案取出来"""
    try:
        body = resp.json()
        if isinstance(body, dict):
            return body.get("error") or body.get("message") or ""
    except Exception:  # noqa: BLE001  错误体不是 JSON 就算了
        pass
    return ""


def _download_image(image_url: str) -> tuple[bytes, str, str]:
    """把 image_url 拉成字节。校色接口吃的是文件字节，不是 URL 也不是 base64。

    Returns:
        (image_bytes, filename, content_type)

    Raises:
        CorrectionError: 下载失败（超时 / 404 / 网络不可达）
    """
    try:
        resp = httpx.get(
            image_url,
            timeout=httpx.Timeout(settings.CORRECTION_DOWNLOAD_TIMEOUT),
            # httpx 默认不跟随重定向，而 OSS / CDN 常有一次跳转，这里必须打开
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.TimeoutException as exc:
        raise CorrectionError("IMAGE_DOWNLOAD_TIMEOUT", "图片下载超时，请重试") from exc
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        raise CorrectionError(
            "IMAGE_NOT_FOUND", f"图片获取失败（HTTP {status}），可能已失效"
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise CorrectionError("IMAGE_NOT_FOUND", f"图片获取失败: {exc}") from exc

    if not resp.content:
        raise CorrectionError("IMAGE_NOT_FOUND", "图片内容为空")

    # 文件名去掉 query 再取最后一段；content-type 去掉 charset 等参数
    filename = image_url.split("?")[0].rstrip("/").rsplit("/", 1)[-1] or "image.jpg"
    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()

    logger.debug(f"[image_correction] 已下载图片 {len(resp.content)} 字节，filename={filename} type={content_type}")
    return resp.content, filename, content_type


def _call_correction_api(image_bytes: bytes, filename: str, content_type: str) -> dict:
    """multipart 转发给校色接口，返回原始 JSON 响应

    Raises:
        CorrectionError: 超时 / 4xx / 5xx / 网络异常（超时与 5xx 会重试）
    """
    last_err: Optional[CorrectionError] = None

    for attempt in range(settings.CORRECTION_RETRY + 1):
        try:
            resp = httpx.post(
                settings.CORRECTION_API_URL,
                files={"image": (filename, image_bytes, content_type)},
                timeout=httpx.Timeout(settings.CORRECTION_TIMEOUT),
            )

            # 4xx 说明是我们的请求本身有问题（图不支持、参数错），重试没有意义
            if 400 <= resp.status_code < 500:
                detail = _extract_api_error(resp) or f"图片不被校色服务接受（HTTP {resp.status_code}）"
                raise CorrectionError("INVALID_IMAGE", detail)

            resp.raise_for_status()
            raw = resp.json()
            if not isinstance(raw, dict):
                raise CorrectionError("CORRECTION_FAILED", "校色服务返回了非预期的数据格式")

            logger.debug(f"[image_correction] 校色接口返回 status={resp.status_code} passed={raw.get('passed')}")
            return raw

        except CorrectionError as exc:
            last_err = exc
            if exc.code == "INVALID_IMAGE":
                break  # 不可重试，直接跳出
            logger.warning(f"[image_correction] 第 {attempt + 1} 次调用失败：{exc.message}")
        except httpx.TimeoutException:
            last_err = CorrectionError("PROCESSING_TIMEOUT", "校色服务响应超时，请稍后重试")
            logger.warning(f"[image_correction] 第 {attempt + 1} 次调用超时")
        except httpx.HTTPStatusError as exc:
            last_err = CorrectionError("CORRECTION_FAILED", f"校色服务返回 {exc.response.status_code}")
            logger.warning(f"[image_correction] 第 {attempt + 1} 次调用返回 {exc.response.status_code}")
        except Exception as exc:  # noqa: BLE001
            last_err = CorrectionError("CORRECTION_FAILED", f"校色服务调用失败: {exc}")
            logger.warning(f"[image_correction] 第 {attempt + 1} 次调用异常：{exc}")

    raise last_err or CorrectionError("INTERNAL_ERROR", "校色失败")


def _normalize_correction_response(raw: dict) -> dict:
    """把校色接口的原始响应归一化成前端 CorrectionResult 契约（见 API.md）"""
    candidates = [
        {
            "correctedImage": item.get("corrected"),
            "distance": item.get("distance"),
            "modelName": item.get("model_name"),
        }
        for item in (raw.get("results") or [])
        if isinstance(item, dict)
    ]

    return {
        # 注意：passed=false 时依然是 success=True，见文件头约定 2
        "success": True,
        "passed": bool(raw.get("passed")),
        "originalImage": raw.get("original"),
        "candidates": candidates,
        "distance": raw.get("distance"),
        "threshold": raw.get("threshold"),
        "brand": raw.get("brand"),
        "deviceInfo": raw.get("device_info"),
        "elapsedTime": raw.get("elapsed_time"),
        "error": raw.get("error"),  # 仅 passed=false 时有值
    }


@tool
def image_correction(image_url: str) -> dict:
    """图片一键校色工具（手机拍摄环境标准化校正）。

    何时使用：用户上传了一张照片，希望校正颜色、还原真实色彩、校准白平衡，
    或反馈照片「偏色 / 发黄 / 颜色不对」。

    Args:
        image_url: 待校正图片的完整可访问 URL，由后端在图片落盘后生成。
                   必须传 URL，不要传 base64。

    Returns:
        dict: 校色结果。passed=false 表示拍摄环境不达标，应引导用户重新拍摄。
    """
    try:
        image_bytes, filename, content_type = _download_image(image_url)
        raw = _call_correction_api(image_bytes, filename, content_type)
        return _normalize_correction_response(raw)
    except CorrectionError as exc:
        logger.warning(f"[image_correction] 失败 errorCode={exc.code} msg={exc.message}")
        return {"success": False, "errorCode": exc.code, "error": exc.message}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[image_correction] 未预期异常")
        return {"success": False, "errorCode": "INTERNAL_ERROR", "error": f"校色失败: {exc}"}


# ---------------------------------------------------------------------------
# 未实现的工具 —— **故意不注册**，别急着往 get_all_tools() 里加
#
# 下面 4 个能力前端已有入口（快捷按钮 + 结果卡片），但后端没有真实实现。
# 它们**绝不能注册进工具列表**，原因是实测过的：
#
#   注册 stub 后，用户点「智能取色」会得到 type=pick 的响应，metadata 里是
#   **写死的假色值**（#FF5733 / #33FF57 / #3357FF…），LLM 还会围绕这些假数据写出
#   "主色调为橙红，属于暖色系，视觉上偏活泼"这类看起来很专业的分析。
#   用户完全无法分辨真假 —— 这比报错严重得多。
#
# 各能力的真实前置条件：
#   - pick / compare / phone：搭档的视觉服务**尚未交付**对应接口。
#     `doc/python工具方协议.md` 只是「协议建议稿」（通篇"建议/你们需要约定"），
#     不是已实现的接口文档；真实已交付的只有校色接口。
#   - pick：语义已定为「点击采样像素」（2026-09-15 用户确认），需要前端先补
#     点击取点 UI，并把**原图坐标** x/y 传给后端（坐标换算由前端负责）。
#     前端目前根本不传坐标，唯一的入口是校色卡片的「去取色」。
#   - convert：纯色彩空间换算，不需要图片、也不依赖搭档接口，是最容易先做成
#     真实现的一个（前端 src/utils/colorConverter.ts 已有同套换算可对齐口径）。
#
# 前端契约（以 ColorAI/src/types/index.ts 为准，别自创结构）：
#   pick    → { color: FullColorValues, colorName: string }
#   compare → { similarity, deltaE, imageA: {imageUrl, dominantColors}, imageB: {...} }
#   convert → { input, detectedFormat, color: FullColorValues, colorName }
#   phone   → { originalUrl, correctedUrl, standardUrl, adjustment: {...} }
#   FullColorValues = { hex, rgb, hsl, cmyk, lab, hsv }
#
# 实现一个 → 在 get_all_tools() 注册一个 → 在 agent.py 的 FEATURE_TOOL_MAPPING
# 登记一个（顺序别乱：只登记图片参数是 URL 的工具）。
# ---------------------------------------------------------------------------


def get_all_tools():
    """获取所有**已实现**的工具

    只返回真实可用的工具。未实现的工具绝不能出现在这里：LLM 会调用它并返回编造数据。
    """
    return [image_correction]
