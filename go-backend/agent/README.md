# ColorAI Agent

基于 LangGraph 的色彩处理智能体服务，提供 AI 对话、图片校色与色彩知识库（RAG）检索能力。

## 功能特性

- **智能对话**：自然语言交互，由 LLM 按语义选择工具
- **图片一键校色**：对接搭档提供的校色接口，校正白平衡与偏色
- **色彩知识问答**：RAG 语义检索（色彩理论 / 心理学 / 配色 / 文化象征 / 行业应用 / 颜色寓意）
- **颜色数据查询**：按色值 / 色系 / 颜色名精确查询 310 种精选颜色
- **统一接口**：与 Go 后端接口格式兼容
- **可扩展**：新增工具只需三步（见「开发说明」）

## 内置工具

**只注册已实现的工具。** `get_all_tools()`（`app/tools/color_tools.py`）返回的就是下表全部内容，
`SYSTEM_PROMPT` 也只宣传这里列出的能力。

| 工具名称 | 功能说明 | 数据来源 | 状态 |
|----------|----------|----------|------|
| `image_correction` | 图片一键校色（对接搭档校色接口） | 外部校色 API | ✅ 已实现 |
| `color_knowledge_search` | 色彩知识语义检索（理论 / 心理学 / 配色 / 文化象征 / 行业应用 / 颜色寓意） | `kb_chunks`（1,320 块向量） | ✅ 已实现 |
| `color_lookup` | 按色值 / 色系 / 颜色名查询 310 种精选颜色 | `kb_colors`（精确 SQL 查询） | ✅ 已实现 |

以下 4 个能力**尚未实现，故意不注册**：`color_extraction`（智能取色）、
`color_comparison`（颜色对比）、`color_conversion`（颜色格式转换）、
`phone_correction`（手机拍摄校色）。前端工具坞同步置灰并打「开发中」角标。

> ⚠️ 它们曾经以 stub 形式注册过，返回写死的假数据（`#FF5733` 之类），
> LLM 会把编造的色值包装成「主色调为橙红，属于暖色系」这种专业结论 ——
> **用户无法分辨真假**。这是本项目踩过的最严重的一类坑，详见
> `go-backend/doc/图片校色Tool封装设计.md` §8.2。

**两个知识工具与校色工具形态不同**，接入时必须区分：

- **不产出卡片**：不在 `TOOL_TYPE_MAPPING` 里 → 返回 `type=text` + `metadata=null`
  （防止 1–2 KB 检索原文落库，见 `agent.py` §4.3）
- **不进 `FEATURE_TOOL_MAPPING`**：属自由输入场景，由 LLM 语义判断，没有对应的快捷按钮
- **`results=[]` / `matched=0` 是正常业务分支**（库里没有 → 如实说明未收录），
  与校色工具的 `passed=false` 同理：**绝不 raise**，`success` 恒为 `True`

## RAG 知识库

完整设计（含全部决策依据与实测数据）见 `doc/RAG知识库设计.md`。

### 链路

```
doc/颜色寓意全息宝典.md   ─┐
                           ├─ 解析+切块 → 1,320 块 ─→ BGE-M3(1024 维) ─┐
doc/颜色知识问答1000题.md  ─┘                                          ├─→ PostgreSQL + pgvector
                                                                       │   schema: colorai_kb
              kb_colors（310 行，精确查询，不进向量检索） ──────────────┘
```

### 数据源与规模

| 文件 | 产出块 |
|------|--------|
| `doc/颜色寓意全息宝典.md` | 310 单色块 + 10 色系块 = **320** |
| `doc/颜色知识问答1000题.md` | **1,000** 问答块（一题一块，不再切） |
| **合计** | **1,320 块** × 1024 维 |

色系恰好 10 个，其中两个含 `/`（`青色/蓝绿系`、`灰色/黑/白/银系`）——
色系查询要做别名归一化，否则「青色系」匹配不到「青色/蓝绿系」。

### 三张表（`colorai_kb` schema）

| 表 | 用途 | 规模 |
|---|---|---|
| `kb_chunks` | 文本块 + 向量，`kind` = `color` / `family` / `qa` | 1,320 |
| `kb_colors` | 结构化色值（`hex` 主键），**精确查询用，不进向量检索** | 310 |
| `kb_builds` | 构建审计：每次入库成功后追加一行（模型 / 维度 / 块数 / 源文件 sha256） | 每次 1 行 |

**三条设计要点：**

1. **必须用独立 schema `colorai_kb`**。目标库 `docmind` 的 `public` 下已有 65 张表
   （含别人的 `chunks` / `chunk_vectors` / `vector_stores` / `knowledge_bases`）——
   往 `public` 加表会同名互踩，且极难排查。所有 SQL 用全限定名 `colorai_kb.<table>`。
2. **不建 HNSW 索引**。1,320 行做精确顺序扫描是亚毫秒级，近似索引反而损召回（负优化）。
   何时建：**> 10 万行 或 P95 > 100 ms**。
3. **`kb_colors` 必须单独一张表**。BGE-M3 对 `#A52A2A` 这种十六进制串**没有语义**，
   向量检索在此不可靠，精确色值只能 `WHERE hex = $1`。

### 入库与运维脚本

```bash
cd go-backend/agent

# 1. 预检 PG（纯标准库、只发 SELECT，密码走环境变量不落盘）
PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=... \
    ./.venv/Scripts/python.exe scripts/pg_preflight.py

# 2. 建 schema + 三张表（幂等，可反复执行）
./.venv/Scripts/python.exe scripts/create_tables.py

# 3. 入库：解析 → 断言 → 向量化 → 全量重建
./.venv/Scripts/python.exe scripts/ingest_knowledge.py --dry-run   # 只解析+断言，0 成本
./.venv/Scripts/python.exe scripts/ingest_knowledge.py             # 正式入库
```

| 脚本 | 作用 |
|------|------|
| `pg_preflight.py` | PG 只读预检（手写 SCRAM-SHA-256，**零依赖**，未装包时也能跑） |
| `create_tables.py` | 建 `colorai_kb` schema 与三张表（DDL 与设计文档 §2 一致，全 COMMENT） |
| `ingest_knowledge.py` | 入库编排；块数 / 文本一致性 / 向量维度任一不符即**报错退出** |
| `test_knowledge_tools.py` | 单跑两个知识工具（真实调用 embedding + PG，不经 LLM / Agent / Go） |
| `test_image_correction.py` | 单跑 `image_correction`（起临时静态服务把本地图变成 URL，走生产同一条代码路径） |
| `check_tracing.py` | LangSmith 自检（默认离线零成本，加 `--live` 才真发一次调用） |

## 快速开始

### 1. 安装依赖

```bash
cd go-backend/agent
pip install -r requirements.txt
```

> Embedding 走**硅基流动 API**（复用已有的 `openai` SDK），
> 所以**不需要** `sentence-transformers` / `torch` / `langchain-huggingface`
> —— 省下约 2 GB 依赖与约 400 MB 内存。

### 2. 配置环境变量

```bash
cp .env.example .env
```

**必填 / 常用键：**

| 键 | 说明 |
|----|------|
| `DEEPSEEK_API_KEY` | **必填**，对话模型 |
| `EMBEDDING_API_KEY` | **知识库必填**，硅基流动（BGE-M3） |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DB` | **知识库必填**，PostgreSQL 连接 |
| `AGENT_PORT` | 默认 `8000`，**必须与 Go 侧 `AGENT_URL` 一致** |
| `DEEPSEEK_THINKING` | 保持 `false`。带 tools 请求时思考模式要求回传 `reasoning_content`，而 langchain-openai 0.2.1 不处理该字段 → 必然 400 |
| `CORRECTION_API_URL` | 校色服务地址，`.env.example` 已预填，一般不用改 |
| `PG_SCHEMA` | 默认 `colorai_kb`，**不要改成 `public`** |
| `KNOWLEDGE_ENABLED` | 知识库总开关，默认 `true` |
| `RETRIEVAL_TOP_K` / `RETRIEVAL_MAX_K` / `RETRIEVAL_MIN_SCORE` | 检索条数与相似度下限（默认 5 / 10 / 0.60） |
| `LANGSMITH_TRACING` / `LANGSMITH_PROJECT` / `LANGSMITH_API_KEY` | 可选链路追踪，见下文 |

**两条格式硬规则（都踩过，都是静默失败）：**

1. **`.env` 必须是 `KEY=VALUE`。** 混入 YAML 块会**静默失败**：`python-dotenv` 报 warning 后跳过，
   Docker Compose 则半解析成一堆垃圾环境变量 —— 两边都不报错，极难发现。
2. **往 `.env` 加新键，必须同步在 `app/config.py` 的 `Settings` 里加字段。**
   pydantic-settings 默认 `extra="forbid"`，`.env` 里出现模型未声明的键 → `Settings()` 抛
   `extra_forbidden` → **整个服务起不来**。（`os.environ` 里的无关变量**不会**触发，只有 `.env` 文件里的键会被检查。）

### 3. 启动服务

```bash
python -m app.main
```

服务在 http://localhost:8000 启动（端口来自 `AGENT_PORT`，**不是** `PORT`）

### 4. 访问 API 文档

打开浏览器访问 http://localhost:8000/docs 查看交互式 API 文档

### 5. 链路追踪（可选）

LangSmith 已接入，**代码零改动** —— 只靠 `.env` 里的三个变量：

```bash
LANGSMITH_TRACING=true      # 必须是小写 true（True / 1 都不生效）
LANGSMITH_PROJECT=colorAI    # 填 project 的 name，不是 UUID 形式的 id
LANGSMITH_API_KEY=lsv2_...
```

自检：

```bash
./.venv/Scripts/python.exe scripts/check_tracing.py          # 离线检查
./.venv/Scripts/python.exe scripts/check_tracing.py --live   # 真发一次调用并回查
```

**已知盲区**：只覆盖 Python 这一层。Go(:3001) 整层看不到；embedding（裸 `openai`）与
PG 检索（裸 `psycopg`）不在 LangChain callback 体系内，默认抓不到；
`feature` 短路路径不走 graph，产生的是两条平级 root trace 而非一棵树。

## Docker 部署

### 使用 docker-compose

```bash
cd go-backend/agent

# 设置环境变量
export DEEPSEEK_API_KEY=your_api_key_here

# 启动服务
docker-compose up -d
```

`.env` 在**运行时**注入（`env_file`，`required: false`），不烘进镜像 ——
`.dockerignore` 已排除 `.env`，否则密钥会永久留在镜像层里（`docker history` 能翻出来）。

### 手动构建

```bash
docker build -t colorai-agent .
docker run -p 8000:8000 -e DEEPSEEK_API_KEY=your_key colorai-agent
```

## API 接口

### 聊天接口

```
POST /api/chat
```

**请求示例：**

```json
{
  "sessionId": "session-uuid",
  "messageId": "msg-xxx",
  "messages": [
    {
      "role": "user",
      "content": "帮我进行图片校色",
      "feature": "correct",
      "images": ["http://localhost:3001/uploads/chat/2026/09/17/xxxx.jpg"]
    }
  ]
}
```

两点约定：

- **`images` 里是 URL，不是 base64。** Go 侧收到前端 dataURL 后先解码落盘、拼出完整 URL
  （前缀来自 `PUBLIC_BASE_URL`），**只把 URL 传给 Agent**。几 MB 的 base64 既进不了
  LLM 的 tool 参数（tool 参数由 LLM 生成 token），也会让请求体膨胀。
- **`feature` 挂在消息上**（不是 `ChatRequest` 顶层），且是**工具选择的最高优先级信号**：
  非空时代码直接调用映射的工具、不让 LLM 选（映射表见 `agent.py` 的 `FEATURE_TOOL_MAPPING`）；
  为 `null` 时才走语义分析。

**响应示例：**

```json
{
  "success": true,
  "message": {
    "id": "msg_xxx",
    "role": "assistant",
    "type": "correct",
    "content": "已为您完成图片校色",
    "metadata": {
      "success": true,
      "passed": true,
      "originalImage": "http://localhost:3001/uploads/chat/2026/09/17/original.jpg",
      "candidates": [
        {
          "correctedImage": "http://localhost:3001/uploads/chat/2026/09/17/corrected.jpg",
          "distance": 12.3,
          "modelName": "iPhone 15 Pro"
        }
      ],
      "distance": 12.3,
      "threshold": 20,
      "brand": "Apple",
      "elapsedTime": 3.1
    },
    "createdAt": 1694678400000
  }
}
```

`metadata` 的结构由 `message.type` 决定，**契约以前端 `ColorAI/src/types/index.ts` 为准**
（`CorrectionResult` / `CompareResult` / `PhoneCorrectResponse` / `FullColorValues`），
工具返回值必须逐字段对齐。注意 `color` 这类字段要给结构化分量对象，
不能是 `"rgb(1, 2, 3)"` 这种预格式化字符串 —— 格式化是前端的事。

`type=text` 时 `metadata` 为 `null`，前端按纯文本渲染。**两个知识工具的回复就是这一形态**
（包括「知识库未收录」这种如实说明）。

### 健康检查

```
GET /health
```

## 项目结构

```
agent/
├── app/
│   ├── api/                    # API 路由
│   │   ├── chat.py             # 聊天接口
│   │   └── health.py           # 健康检查
│   ├── core/
│   │   └── agent.py            # LangGraph 智能体（SYSTEM_PROMPT / 两张映射表）
│   ├── tools/                  # 工具定义（一个工具一个文件）
│   │   ├── color_tools.py      # image_correction + get_all_tools()
│   │   ├── color_knowledge_search.py  # 知识库语义检索
│   │   └── color_lookup.py     # 310 色精确查询
│   ├── knowledge/              # RAG 知识库
│   │   ├── embedder.py         # BGE-M3 薄封装（硅基流动 API）
│   │   ├── ingest.py           # 语料解析 + 切块
│   │   └── store.py            # 三张表的存储层（检索 / 全量重建 / 校验）
│   ├── models/                 # 数据模型（按类别拆分：枚举/请求/响应/健康）
│   │   ├── enums.py
│   │   ├── chat_request.py
│   │   ├── chat_response.py
│   │   └── health.py
│   ├── utils/                  # 预留（当前为空）
│   ├── config.py               # 配置管理（含 load_dotenv，见下）
│   └── main.py                 # 主应用
├── doc/
│   ├── RAG知识库设计.md         # RAG 设计文档（决策依据 + 实测数据）
│   ├── 颜色寓意全息宝典.md       # 语料：310 单色 + 10 色系
│   └── 颜色知识问答1000题.md     # 语料：1,000 问答
├── scripts/                    # 运维与自检脚本（见上表）
├── logs/                       # 运行时日志（loguru，10 MB 轮转 / 保留 7 天）
├── manager.go                  # Go 侧启动器（属 Go 后端，见下）
├── requirements.txt            # Python 依赖
├── Dockerfile                  # Docker 配置
├── docker-compose.yml          # Docker Compose 配置
├── .dockerignore               # 构建上下文排除（**含 .env**，别删）
├── .env.example                # 环境变量示例
└── .venv/                      # 本地虚拟环境
```

## 与 Go 后端集成

Go 后端通过 HTTP 调用本服务，地址来自 `config.AgentURL`（`go-backend/.env` 的 `AGENT_URL`，
默认 `http://localhost:8000`）—— **不要硬编码**。它同时驱动两处：
`service/chat_service.go` 的 `/api/chat` 转发，和 `agent/manager.go` 的 `/health` 探活。

```go
// 地址来自 config.AgentURL
resp, err := http.Post(cfg.AgentURL+"/api/chat", "application/json", requestBody)
```

⚠️ `AGENT_URL` 必须与 `agent/.env` 的 `AGENT_PORT` 保持一致 ——
Python 侧监听的端口来自 `settings.AGENT_PORT`（**不是** `PORT`，那个是 Go 的，
当初就是为了避免两者混淆才这么命名）。

Go 后端启动时会**自动拉起**本服务（`agent/manager.go`），所以本地开发一般不用单独启动；
要单独跑见上面的「启动服务」。注意 Go 是按**当前工作目录**去找 `agent/` 的，
所以必须在 `go-backend/` 目录下启动它。

## 开发说明

### 添加新工具

1. 在 `app/tools/` 下新建文件（或写入 `color_tools.py`），用 `@tool` 装饰器定义工具
2. 在 `get_all_tools()` 中注册
3. 更新 `app/core/agent.py` 的 `SYSTEM_PROMPT`，把该能力从「未上线」挪到「已上线」
4. **按工具形态补映射**（这一步最容易漏）：
   - **产出卡片的工具**（如 `image_correction`）→ 在 `TOOL_TYPE_MAPPING` 登记 `工具名 → type`，
     结果进 `metadata`；若是快捷工具，还要在 `FEATURE_TOOL_MAPPING` 登记
     `feature → (工具名, 图片参数名)`，前端快捷按钮才能走确定性短路
   - **纯文本工具**（如两个知识工具）→ **两张表都不进**，产出 `type=text` + `metadata=null`
5. 前端把 `ColorAI/src/constants/workspace.ts` 里对应项的 `available` 改成 `true`

**三条硬规则：**

- **未实现的工具绝不能注册**，也不要写进 `SYSTEM_PROMPT`。注册了 LLM 就会调用它，
  然后拿假数据编出专业结论 —— 用户分辨不出来。
- **两条路径都要通才算接入**：`feature` 非空时走短路（用不带 tools 的 `self.llm` 生成总结，
  避免重复调用），为空时走 LLM 语义分析。
- **改返回结构必须同步前端契约**（`ColorAI/src/types/index.ts`），并检查
  `Workspace.tsx` 与 `hooks/useSession.ts` **两处**都走 `buildResultFields` ——
  只改一处会出现「刚发完能渲染、刷新后卡片变纯文本」。

完整流程与踩坑清单见 `go-backend/doc/图片校色Tool封装设计.md`。

### 维护知识库

| 场景 | 做法 |
|------|------|
| 改了 `doc/` 下的语料 | 重跑 `create_tables.py` + `ingest_knowledge.py`（全量重建，TRUNCATE 后重灌，事务内完成） |
| 换 embedding 模型 | **必须全量重建**；维度变了要同步改 `EMBEDDING_DIM` 与 DDL 的 `vector(N)` |
| 调检索质量 | 改 `RETRIEVAL_MIN_SCORE`；**别急着上 BM25 / reranker** —— 先建金标集量出基线，无 Recall@5 提升就不上 |
| 检索结果不对 | 先跑 `scripts/test_knowledge_tools.py`（不经 LLM），排除工具层问题再怀疑 LLM |

入库脚本自带断言：块数不符 / 文本与源文件不一致 / 向量维度 ≠ `EMBEDDING_DIM` 都会**报错退出**，
不会静默写入半成品。

### 修改智能体逻辑

编辑 `app/core/agent.py` 中的 `ColorAgent` 类。

> 注：`app/config.py` 里有一处 `load_dotenv()`（绝对路径），看起来像多余 ——
> 它**必须存在**：LangSmith 的 tracer 只读 `os.environ`，而 pydantic-settings 的 `env_file`
> 只填充 `Settings` 对象、**不写 `os.environ`**，不注入则 `.env` 里的 `LANGSMITH_*` 永远不生效
> （不报错，只是不上报）。别顺手删掉。

## 许可证

MIT License
