"""单独跑通 color_knowledge_search / color_lookup 工具（不经 LLM、不经 Agent、不经 Go）。

覆盖设计文档 §6.1 全用例 + ToolNode 序列化（硬规则 3）+ 负向用例。
会真实调用：硅基流动 embedding（3 次）+ PostgreSQL（数次）。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_knowledge_tools.py
"""
import json
import os
import sys
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

from langchain_core.messages import AIMessage  # noqa: E402
from langgraph.prebuilt import ToolNode  # noqa: E402

from app.tools.color_knowledge_search import color_knowledge_search  # noqa: E402
from app.tools.color_lookup import color_lookup  # noqa: E402

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
    print("=== color_knowledge_search（§6.1）===")
    r = color_knowledge_search.invoke({"query": "什么是莫兰迪色"})
    results = r.get("results") or []
    check("正常检索 success=True", r.get("success") is True)
    check("结果非空", len(results) > 0, f"count={r.get('count')}")
    check("每条含 source", all(x.get("source") for x in results))
    check("top3 与问题相关（含「莫兰迪」）",
          any("莫兰迪" in x["content"] for x in results[:3]),
          f"top1 score={results[0]['score'] if results else 'N/A'}")

    r = color_knowledge_search.invoke({"query": "量子色动力学"})
    check("语料外问题 不 raise 且 success=True", r.get("success") is True)
    check("语料外问题 results=[]（MIN_SCORE=0.60 过滤）", r.get("results") == [],
          f"实际 count={r.get('count')}")

    r = color_knowledge_search.invoke({"query": "什么是加色法？", "top_k": 999})
    check("top_k=999 被 RETRIEVAL_MAX_K=10 截断", len(r.get("results") or []) <= 10,
          f"count={r.get('count')}")

    r = color_knowledge_search.invoke({"query": "   "})
    check("空 query → 空结果且不 raise",
          r.get("success") is True and r.get("results") == [])

    print("=== color_lookup（§6.1）===")
    r = color_lookup.invoke({"hex_value": "#a52a2a"})
    hit = (r.get("results") or [{}])[0]
    check("小写 hex 命中「赤褐」（大小写不敏感）",
          r.get("matched") == 1 and hit.get("name") == "赤褐",
          f"name={hit.get('name')}")

    r = color_lookup.invoke({"hex_value": "ff0000"})
    hit = (r.get("results") or [{}])[0]
    check("无 # 小写 hex 命中「正红（朱红）」", hit.get("name") == "正红（朱红）")

    r = color_lookup.invoke({"family": "红色系"})
    check("family=红色系 → 42 条", r.get("matched") == 42, f"matched={r.get('matched')}")

    r = color_lookup.invoke({"family": "青色系"})
    check("family=青色系 归一化命中「青色/蓝绿系」13 条",
          r.get("matched") == 13, f"matched={r.get('matched')}")

    r = color_lookup.invoke({"name": "正红"})
    check("name=正红 模糊命中", (r.get("matched") or 0) >= 1, f"matched={r.get('matched')}")

    r = color_lookup.invoke({"hex_value": "#123456"})
    check("未收录色值 → matched=0 不编造",
          r.get("success") is True and r.get("matched") == 0)

    r = color_lookup.invoke({})
    check("三参数全 None → matched=0 不报错",
          r.get("success") is True and r.get("matched") == 0)

    print("=== 负向用例 ===")
    r = color_lookup.invoke({"hex_value": "红色"})
    check("非法 hex → matched=0 + note 提示格式",
          r.get("matched") == 0 and "note" in r, str(r.get("note"))[:60])

    r = color_lookup.invoke({"family": "宇宙系"})
    check("未知色系 → matched=0 + note 列出可选",
          r.get("matched") == 0 and "note" in r, str(r.get("note"))[:60])

    r = color_lookup.invoke({"family": "红色系", "name": "不存在的颜色名"})
    check("多条件「与」过滤 → matched=0",
          r.get("success") is True and r.get("matched") == 0)

    print("=== ToolNode 序列化（硬规则 3）===")
    node = ToolNode([color_knowledge_search, color_lookup])
    out = node.invoke({"messages": [AIMessage(content="", tool_calls=[{
        "name": "color_lookup", "args": {"hex_value": "#A52A2A"},
        "id": "call_test_1", "type": "tool_call"}])]})
    msg = out["messages"][0]
    check("ToolMessage.name 正确", getattr(msg, "name", None) == "color_lookup")
    parsed = json.loads(msg.content)
    check("content 是合法 JSON 且 success=True", parsed.get("success") is True)
    check("中文未乱码（含「赤褐」）", "赤褐" in msg.content)

    print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
