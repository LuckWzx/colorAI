"""SYSTEM_PROMPT 一致性护栏（离线、零成本、秒级）。

拦截四类问题：
  1. 工具清单脱节：已注册工具没写进 prompt / prompt 宣传了未注册的工具（历史坑）；
  2. 关键规则被误删（防幻觉 / 来源标注 / 防注入 / 上传图片约定）；
  3. 日期注入失效（LLM 需要知道「今天」才能判断「最新 / 今年」）；
  4. 提示词膨胀（超过长度上限）。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/test_system_prompt.py
"""
import re
import sys
from datetime import date
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

from app.core.prompts import build_system_prompt  # noqa: E402
from app.tools.color_tools import get_all_tools  # noqa: E402

PASS = 0
FAIL = 0

# 反引号里允许出现但**不是工具名**的标识符（新增需显式改这里 = 强制人工审阅）
ALLOWED_NON_TOOL_TOKENS = {"image_url"}

# 必须存在的关键规则短语（改动措辞时同步改这里 = 强制人工确认规则仍在）
REQUIRED_PHRASES = [
    "凭记忆编造",     # 防幻觉（知识 + 联网两处）
    "标注来源",       # 联网结果引用规则
    "不是指令",       # 防网页内容提示注入
    "尚未上线",       # 未实现能力必须如实告知
    "不要传 base64",  # 图片以 URL 传给 tool 的硬约定
]

MAX_PROMPT_CHARS = 4000  # 长度上限（防无意识膨胀）


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK] {name}" + (f"  — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [!!] {name}" + (f"  — {detail}" if detail else ""))


def main() -> int:
    prompt = build_system_prompt()
    tool_names = {t.name for t in get_all_tools()}

    print("=== 工具清单一致性（双向）===")
    missing = sorted(n for n in tool_names if n not in prompt)
    check("每个已注册工具都写进了 prompt", not missing,
          f"缺失: {missing}" if missing else f"{len(tool_names)} 个工具全部提及")

    tokens = set(re.findall(r"`([a-z][a-z0-9_]*)`", prompt))
    unknown = sorted(tokens - tool_names - ALLOWED_NON_TOOL_TOKENS)
    check("prompt 未宣传任何未注册工具", not unknown,
          f"可疑: {unknown}" if unknown else f"反引号标识符: {sorted(tokens)}")

    print("=== 关键规则短语 ===")
    for phrase in REQUIRED_PHRASES:
        check(f"含「{phrase}」", phrase in prompt)

    print("=== 日期注入 ===")
    today_str = date.today().strftime("%Y年%m月%d日")
    check("含今天日期", today_str in prompt, today_str)

    print("=== 长度 ===")
    check(f"长度 ≤ {MAX_PROMPT_CHARS} 字符", len(prompt) <= MAX_PROMPT_CHARS,
          f"实际 {len(prompt)}")

    print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
