"""单独跑通 image_matting 工具（不经 LLM、不经 Agent、不经 Go）。

为什么需要局域网 IP（与 test_image_correction.py 的 127.0.0.1 不同）：
    抠图服务在 10.10.30.190 —— 它要**反过来下载**我们提供的图片 URL，
    127.0.0.1 指的是它自己。所以临时图床必须绑 0.0.0.0 并用本机局域网 IP 暴露。
    若公司防火墙拦截，可改用 --image-url 指定一张服务能访问的图片。

会真实调用：抠图服务（提交 + 轮询，实测约 6~15 秒），结果下载到 tool-test-output/。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_image_matting.py
    .venv/Scripts/python.exe scripts/test_image_matting.py --image-url http://...
    .venv/Scripts/python.exe scripts/test_image_matting.py <图片路径>
"""
import argparse
import json
import os
import socket
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

from app.config import settings  # noqa: E402
from app.tools.image_matting import image_matting  # noqa: E402

DEFAULT_IMAGE = AGENT_ROOT.parent / "testdata" / "testimage.jpg"
OUTPUT_DIR = AGENT_ROOT.parent / "tool-test-output"  # go-backend/tool-test-output（已在 .gitignore）


def detect_lan_ip(target_url: str) -> str:
    """探测本机对 target 的出口 IP（UDP connect 不真正发包，仅按路由表选网卡）"""
    parts = urlsplit(target_url)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((parts.hostname or "8.8.8.8", parts.port or 80))
        return s.getsockname()[0]
    finally:
        s.close()


def start_static_server(directory: Path) -> tuple[ThreadingHTTPServer, int]:
    """绑 0.0.0.0 起静态服务（抠图服务要能从局域网访问到），返回 (server, port)"""

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):  # 关掉逐请求日志
            pass

    handler = partial(QuietHandler, directory=str(directory))
    server = ThreadingHTTPServer(("0.0.0.0", 0), handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


def download_result(url: str) -> Path | None:
    """把抠图结果下载到 tool-test-output/，方便肉眼确认透明底"""
    import httpx

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / "matting_result.png"
    try:
        resp = httpx.get(url, timeout=60.0, follow_redirects=True)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        return path
    except Exception as exc:  # noqa: BLE001
        print(f"  ! 下载结果图失败: {exc}")
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description="image_matting 单跑自检")
    ap.add_argument("image_path", nargs="?", default=str(DEFAULT_IMAGE),
                    help="本地测试图片路径（默认 testdata/testimage.jpg）")
    ap.add_argument("--image-url", default=None,
                    help="直接指定图片 URL（跳过临时图床；用于防火墙拦截等场景）")
    args = ap.parse_args()

    server = None
    try:
        if args.image_url:
            image_url = args.image_url
            print(f"使用指定图片 URL : {image_url}")
        else:
            image_path = Path(args.image_path)
            if not image_path.exists():
                print(f"图片不存在: {image_path}")
                return 1
            print(f"测试图片: {image_path}  ({image_path.stat().st_size / 1024:.0f} KB)")
            server, port = start_static_server(image_path.parent)
            lan_ip = detect_lan_ip(settings.MATTING_MCP_URL)
            image_url = f"http://{lan_ip}:{port}/{image_path.name}"
            print(f"临时图床 : {image_url}  （绑 0.0.0.0，供抠图服务反向拉取）")

        print(f"抠图服务 : {settings.MATTING_MCP_URL}")
        print("-" * 70)

        result = image_matting.invoke({"image_url": image_url})
    finally:
        if server:
            server.shutdown()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("-" * 70)

    if not result.get("success"):
        code = result.get("errorCode")
        print(f"结果: 失败  errorCode={code}  error={result.get('error')}")
        if code in ("SERVICE_UNAVAILABLE", "SERVICE_TIMEOUT"):
            print("提示: 服务仅内网可达；若图床被防火墙拦截，可用 --image-url 指定服务能访问的图片")
        return 2

    print(f"结果: 抠图成功  taskId={result.get('taskId')}  elapsedTime={result.get('elapsedTime')}s")
    print(f"结果图 : {result.get('imageUrl')}")

    # OSS 转存断言（OSS_ENABLED=true 时）：结果必须是自有 OSS 的持久 URL
    if settings.OSS_ENABLED:
        base = settings.OSS_PUBLIC_BASE_URL.rstrip("/")
        image_url = result.get("imageUrl") or ""
        if base and image_url.startswith(base + "/"):
            print("转存检查: 已转存自有 OSS ✓")
        else:
            print("转存检查: ❌ 结果未落到自有 OSS（转存失败已降级为临时 URL）")
            print("          → 查 agent 日志里 [image_matting] / [oss_store] 的报错")
            return 3

    saved = download_result(result["imageUrl"])
    if saved:
        print("-" * 70)
        print(f"已下载到本地，可直接打开确认透明底：\n      {saved}")
    return 0


if __name__ == "__main__":
    # Windows 控制台默认 GBK，中文输出会炸，强制 UTF-8
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
