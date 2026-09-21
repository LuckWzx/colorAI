# 颜色知识库 RAG 设计

> 数据源 2 文件 → **1,346 文本块** → BGE（`bge-base-zh-v1.5`，768 维，纯 CPU 进程内加载）→ PostgreSQL + pgvector（**独立 schema `colorai_kb`**）。

---

## 0. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| embedding 模型 | `bge-base-zh-v1.5` (768 维) | C-MTEB 检索 69.49，large 70.46（+0.97）但体积 3 倍，small 61.77 偏弱 |
| embedding 部署 | 进程内加载、纯 CPU | query 向量化 CPU 约 20–80 ms，被 LLM 秒级往返完全淹没；GPU/独立服务增加部署风险，收益不抵 |
| 向量库 | PG + pgvector（同机库 `docmind`） | pgvector 0.8.1 已装；规模仅 1,346 行，精确顺序扫描亚毫秒级 |
| HNSW 索引 | **不建** | 1,346 行的近似检索既慢又损召回；负优化。何时建：>10 万行 或 P95 > 100 ms |
| DeepSeek embedding | 不接 | 官方无该端点（`api-docs.deepseek.com` 端点只有 chat / tool calls / vision / FIM 等） |
| BM25 / reranker | **不上**（P1） | 先建纯向量基线（30 题金标集），无 Recall@5 提升就不上 |
| 33 MB 色彩库 | **舍弃** | 36 万条记录只有 96,919 唯一色值，1080 种文本组合被复制成 144k 条，单色最多重复 5,760 次 → 返回 100 条完全相同的结果（详见附录 A） |

---

## 1. 数据源与切块

### 1.1 数据源

| 文件 | 字节 | 行数 | 产出块 |
|---|---:|---:|---:|
| `颜色寓意全息宝典.md` | 37,387 | 437 | 336 单色 + 10 色系 = **346** |
| `颜色知识问答1000题.md` | 181,873 | 4,041 | **1,000**（一题一块，**不再切**） |
| **合计** | | | **1,346** |

**色系恰好 10 个**（实测逐节核对，每节表格行数 = 标题声明数）。注意其中两个含 `/`：

```
红色系 / 橙色系 / 黄色系 / 绿色系 / 青色/蓝绿系 / 蓝色系 /
紫色系 / 粉色系 / 棕色系 / 灰色/黑/白/银系
```

色系查询要做归一化（去空格、`/` 两侧等价），否则「青色系」匹配不到「青色/蓝绿系」。

### 1.2 切块（核心正则）

**宝典**
- 色系分节：`^## (.+?) · (.+?)（共 (\d+) 种）$`
- 颜色行：`^\| \`(#[0-9A-Fa-f]{6})\` \| (.+?) \| (.+?) \| (.+?) \|$` → `hex`/`name`/`meaning`/`scenes`

**问答**
- 分类：`^## (.+)$`
- Q：`^\*\*Q(\d+): (.+?)\*\*$`
- A：紧随的 `^A: (.+)$`

**任意块数不符 / 文本不一致 / 向量维度 ≠ 768 → 构建报错退出**（断言要能失败，参见 §6.2）。

---

## 2. PostgreSQL Schema

> 库 `docmind` @ `118.31.10.161:5432`，PG **17.9**，**pgvector 0.8.1 已装**，建表权限有。
> 但 `public` 下已有 65 张表（含别人的 `chunks`/`chunk_vectors`/`vector_stores`/`knowledge_bases`）—— **必须建独立 schema，绝不能往 `public` 加表**（同名互踩，难排查）。

```sql
CREATE SCHEMA IF NOT EXISTS colorai_kb;
-- 实际代码建议 SQL 全限定名 colorai_kb.<table>，不依赖会话 search_path

CREATE TABLE colorai_kb.kb_chunks (
  id           TEXT PRIMARY KEY,                  -- 'qa-0421' / 'sym-0137' / 'symfam-09'
  source       TEXT NOT NULL,                     -- '寓意宝典' | '问答1000题'
  section      TEXT,
  kind         TEXT NOT NULL,                     -- 'qa' | 'color' | 'family'
  hex          TEXT,                              -- 仅 kind='color'
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,                     -- sha256，幂等用
  embedding    vector(768),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_chunks_kind ON colorai_kb.kb_chunks(kind);
CREATE INDEX idx_kb_chunks_src  ON colorai_kb.kb_chunks(source);
CREATE INDEX idx_kb_chunks_hex  ON colorai_kb.kb_chunks(hex) WHERE hex IS NOT NULL;

-- 结构化色值（精确查询，不进向量检索）
CREATE TABLE colorai_kb.kb_colors (
  hex     TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  family  TEXT NOT NULL,
  meaning TEXT NOT NULL,
  scenes  TEXT NOT NULL,
  source  TEXT NOT NULL DEFAULT '寓意宝典'
);
CREATE INDEX idx_kb_colors_family ON colorai_kb.kb_colors(family);

-- 构建审计（答「当前索引对应哪版源文件」）
CREATE TABLE colorai_kb.kb_builds (
  id       BIGSERIAL PRIMARY KEY,
  built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model    TEXT NOT NULL,
  dim      INTEGER NOT NULL,
  n_chunks INTEGER NOT NULL,
  n_colors INTEGER NOT NULL,
  sources  JSONB NOT NULL                          -- [{path, sha256, bytes}]
);
```

**为什么 `kb_colors` 必须单独**：BGE 对 `#A52A2A` 这种十六进制串**没有语义**，向量检索在此不可靠，精确色值只能 `WHERE hex = $1`。

---

## 3. Embedding 与检索

### 3.1 BGE 薄封装（**最容易踩的坑**）

`langchain` 的两个 `HuggingFaceEmbeddings` **都没有** `query_instruction` 参数：
- `langchain_community` 版：已弃用（`@deprecated`），源码里确实没有
- `langchain_huggingface` 版：现行推荐，但 `model_config = ConfigDict(extra="forbid")` —— 传未知参数**直接抛异常**

BGE 官方要求：**查询加前缀、文档不加**。顺序反了比不加还差。

```python
# app/knowledge/embedder.py
from langchain_huggingface import HuggingFaceEmbeddings

BGE_QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章："

class BGEEmbedder:
    def __init__(self, model_name: str, device: str = "cpu", cache_dir: str | None = None):
        self._hf = HuggingFaceEmbeddings(
            model_name=model_name,
            cache_folder=cache_dir,
            model_kwargs={"device": device},
            encode_kwargs={"normalize_embeddings": True},   # BGE 必须归一化，否则余弦无意义
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._hf.embed_documents(texts)              # 不加前缀

    def embed_query(self, text: str) -> list[float]:
        return self._hf.embed_documents([BGE_QUERY_PREFIX + text])[0]   # 加前缀
```

### 3.2 检索 SQL

```sql
SELECT id, source, section, kind, content, meta,
       1 - (embedding <=> %s::vector) AS score
FROM kb_chunks
WHERE embedding IS NOT NULL
ORDER BY embedding <=> %s::vector
LIMIT %s;
```

- `<=>` 是**余弦距离**；向量已归一化，`1 - 距离` = 余弦相似度
- pgvector 文本字面量 `'[0.1,0.2,…]'` 直传即可，**无需额外适配包**
- 可选过滤：`WHERE kind = ANY(%s)`（按来源）

---

## 4. 工具层（接入现有 agent）

### 4.1 两个工具

```python
@tool
def color_knowledge_search(query: str, top_k: int = 5) -> dict:
    """色彩知识库语义检索（理论/心理学/配色/文化象征/行业应用）。

    何时用：「什么是…」「为什么…」「…和…有什么区别」「…怎么配」「适合 X 的颜色」。
    返回空 = 知识库里没有，**不得凭记忆作答**。
    """

@tool
def color_lookup(
    hex_value: str | None = None,   # 大小写不敏感
    family:    str | None = None,   # 10 个值，其中 2 个含 /，要做归一化
    name:      str | None = None,   # 模糊匹配
) -> dict:
    """按色值/色系/颜色名精确查询（数据来自 336 种精选颜色）。
    matched=0 = 没有匹配，**不得编造色值**。
    """
```

**必须两个，不可合并**：入参互斥、失败语义不同（「库里没这个色值」 vs 「知识库里没这条知识」）。

**`color_lookup` 不能省**：BGE 对 `#A52A2A` 无语义，必须走 SQL 精确匹配。

### 4.2 不进 `FEATURE_TOOL_MAPPING`

该表语义是「前端点了快捷按钮 → 带图片 → 确定性短路」，短路依赖 `images[0]`。知识检索是自由输入场景（`feature=null`），硬塞会破坏短路机制。**运行时由 LLM 语义判断**走哪个工具。

### 4.3 `core/agent.py` 必要小改（防 1–2 KB 检索原文落库）

```python
# 改前
if tool_result is not None:
    message_type = TOOL_TYPE_MAPPING.get(tool_name or "", "text")
    metadata = tool_result           # 任何成功的工具都塞 → 知识问答会把整段检索原文写进 chat_messages.payload

# 改后
if tool_result is not None:
    mapped = TOOL_TYPE_MAPPING.get(tool_name or "")
    if mapped:                       # 该表语义本来就是「这个工具产出卡片」
        message_type = mapped
        metadata = tool_result
```

效果：`image_correction` 行为**完全不变**；知识工具不在表里 → `type=text` + `metadata=null` → 前端照常渲染、库干净。改完必须跑 `image_correction` 回归。

### 4.4 SYSTEM_PROMPT 同步条款（含反编造）

按约定「**先实现并验证，再改提示词**」。加上：

- 调用 `color_knowledge_search` / `color_lookup` 后，**只依据返回内容作答**
- 标出处（如「据《颜色知识问答1000题》」）—— **绝对不得编造出处**
- 语料外问题：如实说库内没有；若给通用知识，必须声明这是通用知识、不再声称有出处
- **防线**：知识库里的色值是「配色参考」，**不是**用户图片的取样结果。**绝对不要**把库里的色值说成是从用户图片中提取/测量得到的。用户要「取色」时如实说明未上线。

最后这条必须保留——库里躺着 336 个真色值，而「智能取色」恰好是未上线能力，一旦被 LLM 混起来，会产出「已从您的图片中提取到主色调 #A52A2A」这种**看起来合理、实际是编造**的结论。

### 4.5 前端**不动**

两个工具产出 `type=text`：
- **不新增** `AssistantMessage.type` → 不改 `src/types/index.ts`
- **不新增** metadata 结构 → 不动 `buildResultFields` / `API.md` 消息类型表
- 因此不踩「两条路径都要改」那个坑（`Workspace.tsx` + `useSession.switchSession`）

RAG 天然产文本，硬造卡片只会把前端拖进来。若将来做「配色方案卡片」（色块 + 色值展示）单独立项。

---

## 5. 配置与依赖

### 5.1 `app/config.py` 新增

```python
# 知识库
KNOWLEDGE_ENABLED:    bool  = True
RETRIEVAL_TOP_K:      int   = 5
RETRIEVAL_MAX_K:      int   = 10
RETRIEVAL_MIN_SCORE:  float = 0.30        # 余弦相似度下限，校准后定（§6.3）

# Embedding
EMBEDDING_MODEL:      str = "BAAI/bge-base-zh-v1.5"
EMBEDDING_DEVICE:     str = "cpu"
EMBEDDING_CACHE_DIR:  str = "models"     # 容器里 ./models:/app/models 挂卷
EMBEDDING_DIM:        int = 768

# PostgreSQL（独立于 Go 的 MySQL，PG 连接信息放 agent/.env，不放 Go）
PG_HOST/PORT/USER/PASSWORD/DB/SCHEMA/SSLMODE: ...
```

### 5.2 依赖（写进 `requirements.txt`）

```bash
pip install sentence-transformers    # 带 torch ~2 GB（CPU 轮子）
pip install langchain-huggingface
pip install "psycopg[binary]"        # 文本字面量即可，无需额外适配包
# 可选（P1，BM25 混合）：pip install jieba rank_bm25
```

国内网络：`HF_ENDPOINT=https://hf-mirror.com`。权重到 `EMBEDDING_CACHE_DIR`，建议 gitignore + 挂卷（不烘进镜像）。

### 5.3 `.env` 格式（最容易再次踩）

必须是标准 **`KEY=VALUE`**。混入 YAML 块会**静默失败**：`python-dotenv` 报 warning 跳过，Docker Compose 半解析成一堆垃圾 env，两边都不报错。已实测。

### 5.4 `go-backend/agent/.gitignore`（当前没有）

新建：`models/` `.env` `logs/` `__pycache__/` `*.py[cod]`。`models/` 不入库的理由：~400 MB 且已挂卷，本机/容器共用，换机器重新下。

---

## 6. 验证

### 6.1 工具层（不经 LLM / Agent / Go）

| 用例 | 期望 |
|---|---|
| `color_knowledge_search("什么是莫兰迪色")` | success=True、非空、含 source |
| `color_knowledge_search("量子色动力学")` | success=True、results=[]，**不 raise** |
| `color_lookup(hex_value="#a52a2a")` | 命中「赤褐」（大小写不敏感） |
| `color_lookup(family="红色系")` | 42 条 |
| `color_lookup(name="正红")` | 模糊命中 |
| `color_lookup(hex_value="#123456")` | success=True、matched=0、**不编造** |
| `top_k=999` | 被 `RETRIEVAL_MAX_K=10` 截断 |
| 三参数全 None | matched=0，不报错 |

### 6.2 构建期断言（**必须能失败**）

块数 ≠ 1,346 / Q 数 ≠ 1000 / 颜色行数 ≠ 336 / 任一块文本与原文不一致 / 向量维度 ≠ `EMBEDDING_DIM` → 报错退出。故意改一行源，确认它**真的会退出**。

### 6.3 端到端 + 负向用例

| # | 用例 | 期望 |
|---|---|---|
| 1 | 「什么是加色法」 | text + 出处；无卡片 |
| 2 | 「#FF0000 代表什么」 | 命中正红，寓意与原文一致 |
| 3 | 「推荐几个适合办公的颜色」 | 走语义检索，给真实颜色 + 出处 |
| 4 | **「帮我取色」+ 图片** | 必须如实说取色未上线；**绝不得拿库里色值冒充取色结果** |
| 5 | `feature=pick` + 图片（回归） | text + metadata=null |
| 6 | `feature=correct` + 图片（回归） | correct + 卡片 + 3 候选 |
| 7 | 「照片偏黄」（回归） | 仍路由到 `image_correction` |
| 8 | 语料外（如「2026 潘通年度色」） | 如实说库里没有；通用答案不得宣称有出处 |
| 9 | 落库检查 | AI 回复 payload **不含**检索原文 |

**用例 4、5、7 是回归防线** —— 保护本项目历史上最严重的那类事故。

### 6.4 检索质量基线（P0）

建 **30 题金标集**（问答库 20 + 手写 10），度量：
- **Recall@5**：正确块是否进 top-5
- **MRR**：正确块的平均倒数排名
- **拒答准确率**：语料外问题返回空的比例（目标 100%）

**校准 `RETRIEVAL_MIN_SCORE=0.30`**：高了拒正常问题，低了返噪声。0.30 是起点不是结论。

P1 接 BM25 后对比，**无 Recall@5 提升就不上**。

---

## 7. 性能与部署

| 项 | 值 |
|---|---|
| 建库（首次） | 模型下载 ~400 MB + 向量化，CPU 约 1–3 min |
| 建库（增量） | 秒级（靠 `content_hash` 跳过未变块） |
| 检索延迟 | query 向量化 CPU 约 20–80 ms（被 LLM 秒级往返完全淹没） |
| 存储 | 约 5 MB（文本 ~600 B + 向量 3 KB）× 1346 |
| 内存 | BGE 约 400 MB（**懒加载**，首次调用时载 + 进程内缓存，避免拖慢 agent 启动与 `/health` 15 s 超时） |
| 每次问答额外开销 | +1 轮 LLM 往返 + ~1000–1500 输入 token |

**为何纯 CPU 够用**：embedding 延迟被 LLM 往返完全淹没，不是 key path。省下 CUDA 依赖换部署可移植性。

**何时该上 GPU / 独立 embedding 服务**：高频全量重建（语料每天翻倍级）、上 reranker（cross-encoder 量级不同）、Go 侧也做语义搜索。届时切方案 B（TEI / Infinity），`BGEEmbedder` 换成 HTTP 客户端即可，上层调用点一行不用改。

**TEI 备查**（独立 embedding 服务化方案）：BGE 可用、CPU 镜像 `ghcr.io/huggingface/text-embeddings-inference:cpu-1.9`。⚠️ TEI 是否自动处理查询前缀未验证，调用侧必须自己加。⚠️ 镜像体积官方无文档，选型前 `docker pull` 看一眼。

---

## 8. 落地步骤（P0 完成即可上线）

| # | 步骤 | 验证 |
|---|---|---|
| P0-0 | ✅ `scripts/pg_preflight.py` 探活 + pgvector 核查 | 见附录 B |
| P0-1 | `app/knowledge/ingest.py`：解析 + 切块 | 块数 = 1346；抽查 5 块与原文逐字一致 |
| P0-2 | `app/knowledge/embedder.py`：BGE 封装 + 前缀 | `embed_query` 加前缀、`embed_documents` 不加 |
| P0-3 | 建 schema + 建表（§2） + `store.py` | `\d colorai_kb.kb_chunks` 结构正确；count=1346 |
| P0-4 | `scripts/ingest_knowledge.py` 入库 | **幂等**：连跑两次 → 第二次 embedding 调用 0 次 |
| P0-5 | `tools/knowledge_tools.py` + 注册 | 工具层单测（§6.1），不经 LLM |
| P0-6 | 改 `core/agent.py` + SYSTEM_PROMPT | **`image_correction` 回归必须照常出卡片**（§4.3） |
| P0-7 | 全链路脚本（参照 `test_image_correction.py`） | 自由输入问知识 → text + 有出处 |
| P0-8 | 负向用例（§6.3） | 重点验「取色不得被冒充」 |
| P1 | BM25 混合检索（RRF） | 与 P0 基线对比 Recall@5；无提升不上 |
| P2 | 配色方案卡片 / 查询改写 | 各自独立立项 |

---

## 附录 A：33 MB 色彩库舍弃依据

记在这里是防止「将来有人想把它也做进 RAG」。

`100k_Colors_RAG.md`：33,354,533 字节 / 865,120 行 / 144,000 条目。

| 指标 | 实测值 | 含义 |
|---|---:|---|
| 唯一 HEX | 96,919 | 47,081 条是重复色值 |
| 单色最大重复 | `#FFFFFF` 出现 **5,760 次** | 高亮低饱和取整后塌成白 |
| 唯一「心理关键词」值 | 10 | |
| 唯一「推荐场景」值 | 10 | |
| 唯一「使用提醒」值 | 10 | |
| 唯一 HSL 值 | 144,000 | |
| 文本组合上界 | 10 × 10 × 10 = **1,000** | 一条「焦虑时用什么颜色」会返 100 条**完全相同**的结果 |

唯一值得抢救的是 **16 条意图路由**（情绪→色彩方向、场景→色彩方向）。将来产品若要确定性路由，建议**单独整理成配置表**，不把 33 MB 拉回来。

---

## 附录 B：环境与待办

### B.1 实测结果（2026-09-21）

`scripts/pg_preflight.py`（只依赖标准库、只发 SELECT）：

```
服务端:     PostgreSQL 17.9 (Debian), UTF8
pgvector:   已装 0.8.1  ✅  P0 阻塞项解除
扩展:       postgis 3.6.2, pg_search 0.22.2, pg_ivm 1.13,
            fuzzystrmatch, pg_stat_statements
可装未装:   pg_trgm 1.6, pgcrypto 1.3
建表权限:   public schema CREATE = true  ✅
名字占用:   kb_chunks / kb_colors / kb_builds 三个均空闲  ✅
```

跑法：

```bash
cd go-backend/agent
PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=docmind \
    ./.venv/Scripts/python.exe scripts/pg_preflight.py
```

### B.2 待办（不阻塞实现）

- `PG_SSLMODE=disable` 是公网明文 → 至少改 `require`
- `PG_USER=postgres` 是超级用户 → 建议另建最小权限账号，只授 `colorai_kb` schema
- 跟 `docmind` 维护方确认建 schema 是否需要打招呼
- `agent/.env` 的 PG 配置历史上被写成 YAML 已修复（2026-09-21）：必须 `KEY=VALUE`，混入 YAML 块会静默失败

### B.3 本机环境

- **只有独立版 `docker-compose` v5.5.1，没有 `docker compose` 子命令**（`docker: unknown command: docker compose`）。文档统一用 `docker-compose`。daemon 经常没起 → build/run/pull 验不了，但 `docker-compose config` 可离线校验。
- BGE 模型首次加载要几百 MB + 数秒，**首次 `/health` 探活超 15 s 会判失败** —— 故必须懒加载（首次调用时再载）。

---

## 附录 C：相关文档

| 文档 | 关系 |
|---|---|
| `图片校色Tool封装设计.md` | 工具封装方法论模板（工具层三段落 + 错误统一出口 + 负向用例） |
| `.workbuddy-ai/skills/langgraph-tool-wrapping/SKILL.md` | 实施本文时的操作手册（七条硬规则 + 验证清单 + 命令） |
| `python工具方协议.md` | 工具返回结构沿用它 `error_code` 思路；**知识检索不设 errorCode**（空结果是正常业务分支） |
