r"""端到端联调：前端 → Go → Python Agent → 校色 tool → 落库

验证的是「图片 dataURL 在 Go 侧落盘换 URL」这条链路：
    POST /api/chat 带 base64 dataURL
      → Go 落盘到 uploads/chat/yyyy/MM/dd/xxx.jpg 并换成完整 URL
      → Agent 收到 URL（不是 base64）
      → tool 下载 URL → 转发校色接口
      → 结果落库（msg_type / payload 都要对）

前置：Go 后端已启动（cd go-backend && go run . ，它会自动拉起 Python Agent）。

用法（在 go-backend 目录下）：
    agent/.venv/Scripts/python.exe scripts/test_chat_chain.py
"""

import base64
import json
import mimetypes
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BACKEND = "http://localhost:3001"
ROOT = Path(__file__).resolve().parent.parent          # go-backend/
IMAGE = ROOT.parent / "ColorAI" / "public" / "uploads" / "testimage.jpg"
UPLOADS_DIR = ROOT / "uploads"

PHONE = "13800138000"
PASSWORD = "test123"


def http(method: str, path: str, body=None, token: str = None, timeout: int = 180):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(BACKEND + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read().decode() or "{}")


def http_head(path: str) -> tuple[int, int, str]:
    """只取状态码 / 长度 / content-type —— 图片是二进制，不能 json.loads"""
    req = Request(BACKEND + path, method="GET")
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.status, len(resp.read()), resp.headers.get("Content-Type", "")
    except HTTPError as exc:
        return exc.code, 0, ""


def to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def main() -> int:
    if not IMAGE.exists():
        print(f"测试图片不存在: {IMAGE}")
        return 1

    # 1) 登录（账号不存在就先注册）
    status, resp = http("POST", "/api/auth/login", {"phone": PHONE, "password": PASSWORD})
    if status != 200 or not resp.get("token"):
        print(f"登录失败({status})，尝试注册...")
        status, resp = http("POST", "/api/auth/register",
                            {"username": "testuser", "phone": PHONE, "password": PASSWORD})
    token = resp.get("token")
    if not token:
        print(f"拿不到 token: {status} {resp}")
        return 1
    print(f"[1] 登录成功 user={resp.get('user', {}).get('username')}")

    # 2) 建会话
    status, resp = http("POST", "/api/sessions", {"title": "链路联调"}, token)
    session_id = resp.get("session", {}).get("id") or resp.get("id") or resp.get("sessionId")
    if not session_id:
        print(f"建会话失败: {status} {resp}")
        return 1
    print(f"[2] 会话 id={session_id}")

    # 3) 发消息：base64 dataURL + feature=correct
    data_url = to_data_url(IMAGE)
    print(f"[3] dataURL 长度 {len(data_url) / 1024:.0f} KB（原图 {IMAGE.stat().st_size / 1024:.0f} KB）")

    t0 = time.time()
    status, resp = http("POST", "/api/chat", {
        "sessionId": session_id,
        "messageId": f"msg-test-{int(time.time() * 1000)}",
        "messages": [{"role": "user", "content": "一键校色", "feature": "correct", "images": [data_url]}],
    }, token)
    elapsed = time.time() - t0
    print(f"[4] /api/chat 返回 {status}，耗时 {elapsed:.1f}s")

    if not resp.get("success"):
        print(f"    ✗ 失败: {resp.get('error')}")
        return 2

    msg = resp.get("message") or {}
    meta = msg.get("metadata") or {}
    print(f"    type={msg.get('type')}  passed={meta.get('passed')}  candidates={len(meta.get('candidates') or [])}")
    print(f"    content: {(msg.get('content') or '')[:80].replace(chr(10), ' ')}")

    # 4) 校验图片确实落盘了，且 URL 可访问
    print("[5] 校验图片落盘与 URL 可达性")
    files = sorted(UPLOADS_DIR.rglob("chat/**/*.jpg"), key=lambda p: p.stat().st_mtime)
    if not files:
        print("    ✗ uploads 下没找到落盘的图片")
        return 3
    newest = files[-1]
    rel = newest.relative_to(UPLOADS_DIR).as_posix()
    print(f"    落盘文件: {newest.relative_to(ROOT)} ({newest.stat().st_size / 1024:.0f} KB)")

    url = f"http://localhost:3001/uploads/{rel}"
    status, size, ctype = http_head(f"/uploads/{rel}")
    print(f"    URL {url}")
    print(f"      → HTTP {status}, {size / 1024:.0f} KB, {ctype}")

    # 5) 校验落库：msg_type 与 payload
    print("[6] 校验会话持久化")
    status, detail = http("GET", f"/api/sessions/{session_id}", token=token)
    session = detail.get("session") or detail
    messages = session.get("messages") or []
    print(f"    messageCount={session.get('messageCount')} 返回 {len(messages)} 条")
    for m in messages:
        keys = sorted(k for k in m.keys() if k not in ("id", "role", "type", "createdAt", "content"))
        print(f"    role={m.get('role'):9s} type={str(m.get('type')):8s} 附加字段={keys}")
        for img in (m.get("images") or []):
            ok = img.startswith("http")
            print(f"      images[0] = {img[:70]}...  ({'URL ✓' if ok else 'base64 ✗'})")
        if m.get("role") == "assistant" and m.get("metadata"):
            md = m["metadata"]
            print(f"      metadata.passed={md.get('passed')} 候选数={len(md.get('candidates') or [])} "
                  f"distance={md.get('distance')}")

    print("\n完成。")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
