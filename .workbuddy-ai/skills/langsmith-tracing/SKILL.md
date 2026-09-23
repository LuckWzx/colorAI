---
name: langsmith-tracing
description: 给 ColorAI 的 agent 接入或排查 LangSmith 链路追踪。当用户要求「接入 LangSmith」「看 trace」「trace 没上报 / 上报到了别的 project」「配 LLM 可观测性」时使用。
agent_created: true
---

# LangSmith 链路追踪：接入与排查

## 先跑自检，别猜

```bash
cd go-backend/agent && .venv/Scripts/python.exe scripts/check_tracing.py
# 加 --live：再发一次真实 LLM 调用并回查 run 是否落库（花极少 token）
```
它逐项检查「os.environ 注入 → Settings 字段声明 → langsmith 判定」并给出 FAIL 清单。

## 四条硬规则（全部实测踩过，改配置前先读）

1. **`LANGSMITH_PROJECT` 填 project 的 `name`，不是 URL 里的 UUID。**
   填 id **不报错**，但会静默新建一个以该 UUID 命名的 project，trace 全跑偏。
   核对：`GET https://api.smith.langchain.com/api/v1/sessions`（header `x-api-key`）看 id→name。
   本项目：id `a5821740-…` 对应 name `colorAI`。

2. **`LANGSMITH_TRACING` 必须是小写 `true`。**
   langsmith 源码判定是 `var_result == "true"`；`True` / `1` / `yes` 全部**静默失效**。

3. **`.env` 新增键必须同步在 `app/config.py` 的 `Settings` 里声明字段。**
   pydantic-settings 默认 `extra="forbid"` → `.env` 里出现模型未声明的键 →
   `Settings()` 抛 `extra_forbidden` → **服务直接起不来**（不只是 trace 失效）。
   对照实验：`os.environ` 里的无关变量**不会**触发，只有 **`.env` 文件里的键**会被检查。

4. **变量名是 `LANGSMITH_*`。** 拼成 `LANGSMITCH_*` 时 SDK 完全读不到（也不报错）。

## 为什么必须有 load_dotenv

pydantic-settings 的 `env_file` 只填充 `Settings` 对象，**不写 `os.environ`**；
而 langchain / langsmith 的 tracer 只读 `os.environ`。
→ 不显式 `load_dotenv` 的话，`.env` 里的 `LANGSMITH_*` **永不生效，且不报错**。

`app/config.py` 顶部已有（绝对路径，不依赖 cwd；`override=False` 让容器环境变量优先）：
```python
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_FILE)
```

## 正确配置

`.env`：
```
LANGSMITH_TRACING=true          # 小写
LANGSMITH_PROJECT=colorAI       # name，不是 UUID
LANGSMITH_API_KEY=lsv2_pt_...
```
`app/config.py` 的 `Settings`：
```python
LANGSMITH_TRACING: bool = False
LANGSMITH_PROJECT: str = ""
LANGSMITH_API_KEY: str = ""
```

**改完必须重启 agent 进程** —— `tracing_is_enabled()` / `get_tracer_project()` 都带
`@lru_cache`，进程内首次调用后就固定了，改 .env 不重启不生效。

## 接完不等于全看得见 —— 已知盲区

- **Go(:3001) 整层**：LangSmith 只认 LangChain，Go 侧完全看不见。
- **embedding / PG 检索**：`app/knowledge/embedder.py` 用裸 `openai.OpenAI`、
  `store.py` 用裸 `psycopg` → 不在 callback 体系内，默认抓不到。
  要覆盖需手动 `@traceable` 或 `wrap_openai()`。
- **feature 短路路径**（`_append_forced_tool_result` + `self.llm.ainvoke`）不走 graph
  → 得到两条**平级 root trace**，不是「一次请求 = 一棵树」。
- **无 trace_id 贯穿**：Go 生成的请求标识没有透传到 Python。

## 网络与额度（本机实测）

`api.smith.langchain.com` 直连可用：首次 TLS ~5s（冷启动），稳态 ~0.5s / 总 ~0.8s。
上报是后台异步，不阻塞主链路。**别拿首次的 5s 当稳态结论。**
免费额度 5000 traces/月、14 天保留；一次 RAG 问答 ≈ 5-6 个 span。

## 一个副作用

pydantic 的 `extra_forbidden` 报错会把键值**明文**打进 traceback（API key 会出现在
终端/日志里）。现有字段（`DEEPSEEK_API_KEY` 等）都是 `str` 而非 `SecretStr`，风格一致未擅改。
