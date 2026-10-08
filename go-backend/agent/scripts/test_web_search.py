"""单独跑通 web_search 工具（不经 LLM、不经 Agent、不经 Go）。

会真实调用：博查 Web Search API（约 4 次，按次计费）。
覆盖：正常搜索 / freshness 归一化 / 空 query / 未启用开关 / ToolNode 序列化。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_web_search.py
"""
import json
import os
import sys
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

from langchain_core.messages import AIMessage  # noqa: E402
from langgraph.prebuilt import ToolNode  # noqa: E402

from app.config import settings  # noqa: E402
from app.tools.web_search import web_search  # noqa: E402

PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK] {name}" + (f"  — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [!!] {name}" + (f"  — {detail}" if detail else ""))


def main() -> int:
    print("=== web_search 正常路径 ===")
    r = web_search.invoke({"query": "莫兰迪色 配色"})
    results = r.get("results") or []
    check("success=True 且结果非空", r.get("success") is True and len(results) > 0,
          f"count={r.get('count')}")
    check("count 被 SEARCH_COUNT 截断", len(results) <= settings.SEARCH_COUNT,
          f"{len(results)} ≤ {settings.SEARCH_COUNT}")
    check("每条含 title/url/siteName/snippet",
          all(x.get("title") and x.get("url") and x.get("siteName") and x.get("snippet")
              for x in results))
    check("snippet 被 SEARCH_SNIPPET_MAX 截断",
          all(len(x["snippet"]) <= settings.SEARCH_SNIPPET_MAX + 1 for x in results),
          f"max={max((len(x['snippet']) for x in results), default=0)}")

    print("=== freshness 归一化 ===")
    r = web_search.invoke({"query": "色彩 行业新闻", "freshness": "OneWeek"})
    check("大小写不敏感（OneWeek→oneWeek）不报错",
          r.get("success") is True, f"count={r.get('count')}")
    r = web_search.invoke({"query": "莫兰迪色", "freshness": "最近一周"})
    check("非法 freshness 静默忽略（走默认）", r.get("success") is True)

    print("=== 负向分支 ===")
    r = web_search.invoke({"query": "   "})
    check("空 query → 空结果且不 raise",
          r.get("success") is True and r.get("results") == [] and "note" in r)

    try:
        settings.WEB_SEARCH_ENABLED = False
        r = web_search.invoke({"query": "测试"})
        check("未启用 → success=False + 明确提示",
              r.get("success") is False and "未启用" in str(r.get("error")))
    finally:
        settings.WEB_SEARCH_ENABLED = True

    print("=== ToolNode 序列化 ===")
    node = ToolNode([web_search])
    out = node.invoke({"messages": [AIMessage(content="", tool_calls=[{
        "name": "web_search", "args": {"query": "莫兰迪色"},
        "id": "call_test_ws", "type": "tool_call"}])]})
    msg = out["messages"][0]
    check("ToolMessage.name 正确", getattr(msg, "name", None) == "web_search")
    parsed = json.loads(msg.content)
    check("content 是合法 JSON 且 success=True", parsed.get("success") is True)
    check("中文未乱码", "色" in msg.content)

    print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
