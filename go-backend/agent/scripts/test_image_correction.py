"""单独跑通 image_correction 工具（不经 LLM、不经 Agent、不经 Go）

为什么需要一个本地 HTTP 服务：
    tool 的入参是「完整图片 URL」，而测试图片在本地磁盘上。
    起一个临时静态服务把它变成 URL，测的就是生产同一条代码路径
    （真实 HTTP GET + multipart 转发），不额外加"本地路径"分支。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_image_correction.py
    .venv/Scripts/python.exe scripts/test_image_correction.py <图片路径>
"""

import json
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# 允许直接以脚本方式运行（把 agent 根目录加进 sys.path）
AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

from app.tools.color_tools import image_correction  # noqa: E402

DEFAULT_IMAGE = AGENT_ROOT.parent.parent / "ColorAI" / "public" / "uploads" / "testimage.jpg"
OUTPUT_DIR = AGENT_ROOT.parent / "tool-test-output"  # go-backend/tool-test-output（已在 .gitignore）


def start_static_server(directory: Path) -> tuple[ThreadingHTTPServer, int]:
    """在随机端口起一个静态文件服务，返回 (server, port)"""

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):  # 关掉逐请求日志，免得刷屏
            pass

    handler = partial(QuietHandler, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


def save_corrected_images(result: dict) -> list[Path]:
    """把校色结果里的图片下载到本地，方便肉眼比对"""
    import httpx

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []

    targets: list[tuple[str, str]] = []
    if result.get("originalImage"):
        targets.append(("original", result["originalImage"]))
    for idx, cand in enumerate(result.get("candidates") or []):
        if cand.get("correctedImage"):
            targets.append((f"corrected_{idx}", cand["correctedImage"]))

    for name, url in targets:
        try:
            resp = httpx.get(url, timeout=60.0, follow_redirects=True)
            resp.raise_for_status()
            suffix = Path(url.split("?")[0]).suffix or ".jpg"
            path = OUTPUT_DIR / f"{name}{suffix}"
            path.write_bytes(resp.content)
            saved.append(path)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! 下载 {name} 失败: {exc}")

    return saved


def main() -> int:
    image_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_IMAGE

    if not image_path.exists():
        print(f"图片不存在: {image_path}")
        return 1

    print(f"测试图片: {image_path}  ({image_path.stat().st_size / 1024:.0f} KB)")

    server, port = start_static_server(image_path.parent)
    image_url = f"http://127.0.0.1:{port}/{image_path.name}"
    print(f"临时 URL : {image_url}")
    print("-" * 70)

    try:
        result = image_correction.invoke({"image_url": image_url})
    finally:
        server.shutdown()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("-" * 70)

    if not result.get("success"):
        print(f"结果: 失败  errorCode={result.get('errorCode')}")
        return 2

    if not result.get("passed"):
        print("结果: 接口调用成功，但拍摄环境不达标（passed=false）")
        print(f"      error = {result.get('error')}")
        return 0

    print("结果: 校色成功")
    print(f"      brand={result.get('brand')} deviceInfo={result.get('deviceInfo')}")
    print(f"      distance={result.get('distance')} threshold={result.get('threshold')}")
    print(f"      elapsedTime={result.get('elapsedTime')}")
    print(f"      candidates={len(result.get('candidates') or [])}")

    saved = save_corrected_images(result)
    if saved:
        print("-" * 70)
        print("已下载到本地，可直接打开比对：")
        for p in saved:
            print(f"      {p}")

    return 0


if __name__ == "__main__":
    # Windows 控制台默认 GBK，中文输出会炸，强制 UTF-8
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
