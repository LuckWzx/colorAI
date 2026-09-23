"""LangSmith 链路追踪自检 —— 配置是否真的生效、trace 是否真的上报。

默认只做**离线检查**（零成本、零副作用）：import app.config 触发 load_dotenv，
断言 os.environ 里有 LANGSMITH_*，再看 langsmith 自己的判定结果，并确认
Settings 声明了这三个字段（否则 pydantic 的 extra="forbid" 会让服务起不来）。
加 --live 才发一次真实 LLM 调用并回查 run 是否落进 project。

用法（在 go-backend/agent 目录下）：
    .venv/Scripts/python.exe scripts/check_tracing.py
    .venv/Scripts/python.exe scripts/check_tracing.py --live

踩坑背景见 .workbuddy-ai/skills/langsmith-tracing/SKILL.md。
"""
import os
import re
import sys
import time
from pathlib import Path

AGENT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import app.config  # noqa: F401,E402  触发 load_dotenv（必须早于读 os.environ）
from app.config import settings  # noqa: E402

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)

FAILED: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    tail = f"  — {detail}" if detail else ""
    print(f"  [{'OK  ' if ok else 'FAIL'}] {label}{tail}")
    if not ok:
        FAILED.append(label)


tracing = os.environ.get("LANGSMITH_TRACING")
project = os.environ.get("LANGSMITH_PROJECT") or ""
api_key = os.environ.get("LANGSMITH_API_KEY") or ""

print("=== LangSmith 追踪自检 ===")
print(f"cwd = {os.getcwd()}")
print("\n[1] os.environ（tracer 只认这里，不认 .env 文件）")
check("LANGSMITH_TRACING 已注入", tracing is not None, repr(tracing))
check('值是**小写** "true"（True / 1 都不生效）', tracing == "true", repr(tracing))
check("LANGSMITH_PROJECT 已注入", bool(project), repr(project))
check("LANGSMITH_PROJECT 不是 UUID（必须填 project 的 name）",
      bool(project) and not UUID_RE.match(project), repr(project))
check("LANGSMITH_API_KEY 已注入", bool(api_key),
      f"len={len(api_key)}" if api_key else "")

print("\n[2] Settings 字段声明（缺了会抛 extra_forbidden，服务直接起不来）")
for field in ("LANGSMITH_TRACING", "LANGSMITH_PROJECT", "LANGSMITH_API_KEY"):
    check(f"Settings.{field} 已声明", field in type(settings).model_fields)

print("\n[3] langsmith 自己的判定")
from langsmith import utils as ls_utils  # noqa: E402

enabled = ls_utils.tracing_is_enabled()
tracer_project = ls_utils.get_tracer_project()
check("tracing_is_enabled()", bool(enabled), repr(enabled))
check("get_tracer_project() 与配置一致", tracer_project == project, repr(tracer_project))

if "--live" in sys.argv:
    print("\n[4] 实时验证（会真实调用一次 DeepSeek，消耗极少 token）")
    from langchain_openai import ChatOpenAI  # noqa: E402

    run_name = "check_tracing 自检"
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        openai_api_key=settings.DEEPSEEK_API_KEY,
        openai_api_base=settings.DEEPSEEK_API_BASE,
        temperature=0,
        max_tokens=16,
        extra_body={"thinking": {"type": "disabled"}},
    )
    resp = llm.invoke("只回复两个字：收到", config={"run_name": run_name})
    print(f"       LLM -> {resp.content!r}")

    print("       等待 8s（langsmith 是异步批量上报）...")
    time.sleep(8)

    from langsmith import Client  # noqa: E402

    runs = list(Client().list_runs(project_name=project, limit=5))
    hit = any(r.name == run_name for r in runs)
    check(f"run 已落入 LangSmith project={project!r}", hit, f"最近 {len(runs)} 条")

print()
if FAILED:
    print(f"FAILED — {len(FAILED)} 项未通过：")
    for f in FAILED:
        print(f"  - {f}")
    sys.exit(1)
print("全部通过。")
