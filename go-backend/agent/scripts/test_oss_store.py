"""oss_store 自检：key 规则对齐 Go、幂等、真实转存往返、完整链路（OSS 图 → 抠图 → OSS）。

三个部分：
  ① 离线检查 —— key 格式/扩展名映射/幂等短路/非法 URL 拒绝（不联网、零消耗）；
  ② 在线往返 —— 本地临时图床 → import_url 转存 → 读回校验（字节必须一致）；
  ③ 链路探针 —— 把②转存出的 OSS 图交给 image_matting 工具全流程：
     抠图服务能否拉取 OSS 公网图（真实链路关键前提）+ 结果是否转存回 OSS。

会真实调用：阿里云 OSS（上传/读取/删除）+ 抠图服务（仅③，约 6~15 秒）。
测试对象全部写 chat/ 前缀并在收尾删除（失败会打印残留 key 供手工清理）。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_oss_store.py
    .venv/Scripts/python.exe scripts/test_oss_store.py --skip-live    # 只跑①（不联网）
    .venv/Scripts/python.exe scripts/test_oss_store.py --skip-probe   # 跳过③（不依赖 GPU Worker）
"""
import argparse
import os
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

import httpx  # noqa: E402
from app.config import settings  # noqa: E402
from app.utils.oss_store import _ext_from_mime, _get_bucket, _object_key, import_url  # noqa: E402

DEFAULT_IMAGE = AGENT_ROOT.parent / "testdata" / "testimage.jpg"

# 与 go-backend/pkg/storage/key.go 的 ObjectKey 同构（扩展名按转存源图的 MIME 推导）
_KEY_RE = re.compile(r"^chat/20\d{2}/\d{2}/\d{2}/20\d{6}_\d{6}_[0-9a-f]{16}\.(png|jpg|webp|gif|bmp|heic)$")

_created_keys: list[str] = []  # 测试产生的对象 key（收尾统一清理）
_failures = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global _failures
    if cond:
        print(f"  ✅ {name}")
    else:
        _failures += 1
        print(f"  ❌ {name}" + (f"  —— {detail}" if detail else ""))


def oss_configured() -> bool:
    need = ("OSS_BUCKET", "OSS_ENDPOINT", "OSS_ACCESS_KEY_ID",
            "OSS_ACCESS_KEY_SECRET", "OSS_PUBLIC_BASE_URL")
    missing = [k for k in need if not getattr(settings, k)]
    if missing:
        print(f"❌ OSS 配置缺失：{', '.join(missing)}（见 agent/.env 的 OSS 区块）")
        return False
    return True


def start_static_server(directory: Path) -> tuple[ThreadingHTTPServer, int]:
    """起本地静态服务（import_url 从本机下载，127.0.0.1 即可，无需局域网暴露）"""

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

    handler = partial(QuietHandler, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1]


def offline_checks() -> None:
    print("① 离线检查（不联网）")

    key = _object_key("chat", ".png")
    check("key 格式与 Go ObjectKey 同构（chat/YYYY/MM/DD/时间戳_16hex.png）",
          bool(_KEY_RE.match(key)), key)
    check("两次生成的 key 不同（随机串防枚举，公共读 bucket 的唯一安全边界）",
          _object_key("chat", ".png") != _object_key("chat", ".png"))

    for mime, ext in (("image/jpeg", ".jpg"), ("image/jpg", ".jpg"), ("image/png", ".png"),
                      ("image/webp", ".webp"), ("image/heic", ".heic"), ("image/heif", ".heic")):
        check(f"ext 映射 {mime} → {ext}", _ext_from_mime(mime) == ext)
    check("空 MIME 兜底 .bin", _ext_from_mime("") == ".bin")
    check("非图片 MIME 走标准库（application/pdf → .pdf）", _ext_from_mime("application/pdf") == ".pdf")

    base = settings.OSS_PUBLIC_BASE_URL.rstrip("/")
    already = f"{base}/chat/2026/10/08/20261008_120000_a1b2c3d4e5f60789.png"
    check("幂等短路：本 bucket URL 原样返回（不下载不重传）",
          import_url("chat", already) == already)

    try:
        import_url("chat", "ftp://example.com/a.png")
        check("非 http(s) URL 应拒绝", False, "未抛异常")
    except ValueError:
        check("非 http(s) URL 应拒绝", True)


def live_roundtrip(image_path: Path) -> str | None:
    """② 本地图床 → import_url → 读回校验。返回转存出的 OSS URL（供③复用），失败 None。"""
    print("\n② 在线：转存往返（本地图床 → OSS → 读回）")
    if not image_path.exists():
        check("测试图片存在", False, str(image_path))
        return None

    server, port = start_static_server(image_path.parent)
    try:
        src_url = f"http://127.0.0.1:{port}/{image_path.name}"
        try:
            persistent = import_url("chat", src_url)
        except Exception as exc:  # noqa: BLE001
            check("import_url 转存成功", False, str(exc))
            return None

        base = settings.OSS_PUBLIC_BASE_URL.rstrip("/")
        rel = persistent.removeprefix(base + "/")
        check("返回 URL 属于本 bucket", persistent.startswith(base + "/"), persistent)
        check("路径符合 Go key 规则", bool(_KEY_RE.match(rel)), rel)
        _created_keys.append(rel)

        # 读回校验：状态码 + 字节完全一致（公共读 bucket 匿名 GET）
        try:
            resp = httpx.get(persistent, timeout=30.0, follow_redirects=True)
            check("读回 HTTP 200", resp.status_code == 200, f"status={resp.status_code}")
            check("读回字节与源文件一致", resp.content == image_path.read_bytes(),
                  f"{len(resp.content)} vs {image_path.stat().st_size}")
        except Exception as exc:  # noqa: BLE001
            check("读回校验", False, str(exc))

        # 已验证幂等在线场景（URL 已属于 bucket → 原样返回）
        return persistent
    finally:
        server.shutdown()


def probe_full_chain(oss_url: str) -> None:
    """③ 完整链路探针：OSS 图 → image_matting 全流程（抠图服务拉 OSS 图 + 结果转存回 OSS）"""
    print("\n③ 链路探针：OSS 图 → 抠图服务 → 结果转存 OSS（完整业务链路除 LLM/Go 外全真）")
    from app.tools.image_matting import image_matting

    result = image_matting.invoke({"image_url": oss_url})
    print(f"  工具返回: {result}")
    if not result.get("success"):
        check("完整链路", False,
              f"errorCode={result.get('errorCode')}；若为 TASK_FAILED/超时，先查 GPU Worker："
              "curl 调 list_workers，掉线或抠图服务拉不到 OSS 公网图都会导致失败")
        return

    base = settings.OSS_PUBLIC_BASE_URL.rstrip("/")
    out_url = result.get("imageUrl") or ""
    ok = out_url.startswith(base + "/")
    check("抠图服务拉取 OSS 公网图成功，且结果已转存回 OSS", ok, out_url)
    if ok:
        _created_keys.append(out_url.removeprefix(base + "/"))


def cleanup() -> None:
    if not _created_keys:
        return
    print("\n④ 清理测试对象")
    bucket = _get_bucket()
    for key in _created_keys:
        try:
            bucket.delete_object(key)
            print(f"  🧹 已删除 {key}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! 删除失败 {key}: {exc}（请到 OSS 控制台手工清理）")


def main() -> int:
    ap = argparse.ArgumentParser(description="oss_store 自检")
    ap.add_argument("--skip-live", action="store_true", help="只跑①离线检查（不联网、零消耗）")
    ap.add_argument("--skip-probe", action="store_true", help="跳过③链路探针（不依赖 GPU Worker）")
    ap.add_argument("--image", default=str(DEFAULT_IMAGE), help="往返测试图片（默认 testdata/testimage.jpg）")
    args = ap.parse_args()

    print("=" * 70)
    print("oss_store 自检")
    print(f"bucket : {settings.OSS_BUCKET}  endpoint: {settings.OSS_ENDPOINT}")
    print(f"公网域 : {settings.OSS_PUBLIC_BASE_URL}")
    print("=" * 70)

    if not settings.OSS_ENABLED:
        print("❌ OSS_ENABLED=false —— 本脚本测试 OSS 转存，请先在 agent/.env 启用并配齐")
        return 1
    if not oss_configured():
        return 1

    try:
        offline_checks()
        if not args.skip_live:
            oss_url = live_roundtrip(Path(args.image))
            if oss_url and not args.skip_probe:
                probe_full_chain(oss_url)
    finally:
        cleanup()

    print("\n" + "=" * 70)
    if _failures:
        print(f"结果: {_failures} 项失败 ❌")
        return 1
    print("结果: 全部通过 ✅")
    return 0


if __name__ == "__main__":
    # Windows 控制台默认 GBK，中文输出会炸，强制 UTF-8
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
