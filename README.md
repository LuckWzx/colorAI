# 曲泉AI (ColorAI)

> 基于 AI 大模型的色彩智能体，面向设计师、摄影师、印刷从业者及色彩爱好者，提供智能对话与图像处理功能。

核心价值：让色彩更精准，让专业色彩处理触手可及。

## 功能特性

> 当前版本聚焦**智能体问答模块**（AI 聊天工作台），首页等其余模块暂不在计划内。

| 功能 | 说明 | 路由 |
|------|------|------|
| AI 聊天工作台 | 与色彩智能体对话、会话历史管理，内置工具坞 | `/workspace` |
| 登录 / 注册 | 用户认证 | `/login` |

智能体侧当前注册了 **3 个工具**：图片一键校色、色彩知识问答（RAG 检索）、颜色数据查询。
后两个是自由输入工具，**没有工具坞入口** —— 直接在输入框提问即可（如「什么是莫兰迪色」「#A52A2A 适合什么场景」）。

### 工作台工具坞

工具坞里的每一项都对应智能体侧的一个 Tool。**未实现的工具不会注册进智能体**
（`get_all_tools()` 只返回已实现的），前端同步置灰并打上「开发中」角标 ——
目的是不让智能体拿到编造的数据、包装成专业结论返回给用户。

| 工具 | 说明 | 状态 |
|------|------|------|
| 图片一键校正 | AI 智能白平衡还原真实色彩 | ✅ 已上线 |
| 智能取色器 | 点击图片获取多格式色值 | ⛔ 未实现 |
| 色彩空间转换 | HEX / RGB / CMYK / Lab 实时互转 | ⛔ 未实现 |
| 颜色相似度对比 | ΔE 专业色差量化评分 | ⛔ 未实现 |
| 手机拍摄校色 | 还原人眼视觉真实颜色 | ⛔ 未实现 |

> ⚠️ **工具坞是「已上线工具」的子集，不是全部。** `get_all_tools()` 另外还返回
> `color_knowledge_search`（色彩知识问答）与 `color_lookup`（颜色数据查询）——
> 这两个走自由输入、由 LLM 按语义选择，所以没有对应的快捷按钮。
> 完整清单与各工具的数据来源见 [agent/README.md](go-backend/agent/README.md)。

功能是否可用的**唯一来源**是 `ColorAI/src/constants/workspace.ts` 的 `FEATURES[].available`：
后端实现并注册一个工具后，把对应项改成 `true`（同时补 `agent.py` 的 `FEATURE_TOOL_MAPPING`）
即可同时打开常驻工具坞和「全部工具」面板两处入口，不要在组件里另写判断。

## 技术栈

| 类别 | 技术 |
|------|------|
| **前端** | |
| 框架 | React 18 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3.4 |
| 路由 | React Router DOM 7 |
| 状态管理 | Zustand 5 |
| PWA | vite-plugin-pwa |
| 图标 | Lucide React |
| **后端** | |
| 语言 | Go 1.24 |
| Web 框架 | Gin 1.10 |
| 数据库 | MySQL 8.0（GORM） |
| 缓存 | Redis 6+（go-redis v9） |
| 认证 | Redis Token 存储 |
| 对象存储 | 阿里云 OSS（可选，替代本地磁盘） |
| **AI 智能体** | |
| 框架 | LangGraph + FastAPI |
| LLM | DeepSeek API（`deepseek-flash`） |
| **知识库（RAG）** | |
| 嵌入模型 | BGE-M3（`BAAI/bge-m3`，1024 维，硅基流动 API） |
| 向量库 | PostgreSQL + pgvector（独立 schema `colorai_kb`） |
| 语料 | 1,320 文本块 + 310 色值 |
| 端口 | 8000 |

## 三层架构

```
前端 (React :5173) → Go 后端 (Gin :3001) → Python Agent (FastAPI :8000) → DeepSeek API
                                                                       └→ PostgreSQL (pgvector 知识库)
```

- **前端**：UI 渲染、用户交互
- **Go 后端**：用户认证、会话管理、数据库操作、代理转发
- **Python 智能体**：语义分析、工具选择、LLM 调用、工具执行、知识库检索

> 知识库用的 PostgreSQL 是 **agent 私有的**，Go 侧不访问它 —— Go 只做转发。

## 快速开始

### 环境要求

- Node.js 18+
- Go 1.24+（`go.mod` 声明 `go 1.24.0`，低于此版本会直接编译失败）
- Python 3.10+（用于智能体服务）
- MySQL 8.0+
- Redis 6+
- PostgreSQL 且已安装 **pgvector** 扩展（本项目实测于 PostgreSQL 17.9 + pgvector 0.8.1）
  —— **仅知识库问答需要**。不配也能正常启动，只是两个知识工具会返回「知识库功能未启用」，
  其余功能（对话、校色）不受影响。
- （可选）阿里云 OSS bucket —— **仅当 `STORAGE_DRIVER=oss` 时需要**，且 bucket 必须
  **允许匿名 `GetObject`**（public-read ACL 或 bucket policy 都行；后者更细粒度 ——
  只开 GetObject、不开 ListObjects，别人无法枚举文件列表）。
  原因：Python 侧的校色工具要 `httpx.get(image_url)` 下载图片，私有 bucket 会 403。
  默认 `local` 驱动写本地磁盘，不需要任何云服务。

### 安装依赖

```bash
# 前端
cd ColorAI
npm install

# 后端
cd ../go-backend
go mod tidy

# Python 智能体（必装：Go 后端启动时会自动拉起它）
cd agent
pip install -r requirements.txt
```

### 配置环境变量

```bash
cd go-backend
cp .env.example .env
```

编辑 `go-backend/.env`，填入实际值：

```env
# 服务端口
PORT=3001

# Python 智能体服务地址（必须与 agent/.env 的 AGENT_PORT 一致）
AGENT_URL=http://localhost:8000

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name
DB_AUTO_MIGRATE=true

# Redis 配置
REDIS_ADDR=127.0.0.1:6379
REDIS_PASS=your_redis_password

# 图片存储：local（本地磁盘，默认）| oss（阿里云 OSS，bucket 公共读）
STORAGE_DRIVER=local
UPLOADS_DIR=uploads
# 图片对外访问 URL 前缀。**两种驱动语义不同，切驱动必须同步改**：
#   local → 站点基地址，实际 URL = 它 + /uploads/ + key
#   oss   → bucket 公网域名，实际 URL = 它 + / + key
PUBLIC_BASE_URL=http://localhost:3001
MAX_UPLOAD_BYTES=10485760

# 切 OSS 时填这四项（STORAGE_DRIVER=oss 时必填）
# OSS_ENDPOINT 在「ECS 与 bucket 同 region」时用内网域名，免公网流量费；本地开发用公网域名
# OSS_BUCKET=your-bucket
# OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
# OSS_ACCESS_KEY_ID=your_access_key_id
# OSS_ACCESS_KEY_SECRET=your_access_key_secret

# 允许的前端来源（逗号分隔，可选）。不设时默认 localhost:5173 / localhost:3001；
# 一旦设置就会覆盖默认值，所以要连同默认两项一起写。
# 用局域网 IP 或手机访问时必须在这里加上对应来源，例如：
# CORS_ORIGINS=http://localhost:5173,http://localhost:3001,http://10.10.30.197:5173
```

> **LLM / 校色 / 知识库的密钥都不在 Go 侧。** Go 只做代理转发，实际调用方是 Python 智能体，
> 因此 DeepSeek Key 配在 `go-backend/agent/.env` 的 `DEEPSEEK_API_KEY`，校色服务地址配在
> `CORRECTION_API_URL`；知识库还需要 `EMBEDDING_API_KEY`（硅基流动）与 `PG_*` 连接信息。
>
> 例外：**图片存储的凭据在 Go 侧**（`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`）——
> 因为解码落盘/上传是 Go 干的，Python 只拿到一个现成的图片 URL。

```bash
cd go-backend/agent
cp .env.example .env   # 填入 DEEPSEEK_API_KEY / EMBEDDING_API_KEY / PG_* 等
```

### 启动开发环境

只需启动 Go 后端，Python Agent 会自动随之启动：

```bash
# 终端 1: 编译并启动 Go 后端（会自动拉起 Python Agent）
cd go-backend
go build -o colorai-backend.exe .    # 先编译成真二进制
./colorai-backend.exe                # http://localhost:3001
```

```bash
# 终端 2: 启动前端
cd ColorAI
npm run dev          # http://localhost:5173
```

开发模式下 Vite 会将 `/api` 请求代理到 `http://localhost:3001`。

> **不要用 `go run main.go` 起服务。** `go run` 会另起一个编译后的子进程，
> kill 掉 `go run` 时那个子进程**不会退出**，3001 端口仍被占用；
> 下次启动会报 `bind: Only one usage of each socket address` 直接退出，
> 而你以为服务已经是新的了 —— 很容易误判成「改动没生效」。
>
> 另外**必须在 `go-backend/` 目录下启动**：Go 按当前工作目录去找 `agent/`。

## 知识库（RAG）

智能体的「色彩知识问答」与「颜色数据查询」由本地知识库支撑：
语料 → 切块 → BGE-M3 向量化 → PostgreSQL + pgvector（独立 schema `colorai_kb`）。

首次部署或改了 `agent/doc/` 下的语料后，需要初始化：

```bash
cd go-backend/agent

# 1. 建 schema + 三张表（幂等，可反复执行）
./.venv/Scripts/python.exe scripts/create_tables.py

# 2. 入库：解析 → 断言 → 向量化 → 全量重建
./.venv/Scripts/python.exe scripts/ingest_knowledge.py --dry-run   # 只解析+断言，0 成本
./.venv/Scripts/python.exe scripts/ingest_knowledge.py             # 正式入库
```

连接参数来自 `agent/.env` 的 `PG_*`。设计取舍（表结构、切块规则、检索阈值、
为什么不建 HNSW 索引、为什么色值查询不走向量）见
[RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md)。

## 项目结构

```
colorAI/
├── ColorAI/                 # React 前端
│   └── src/
│       ├── components/      # 共享组件
│       │   ├── SmartImage.tsx  # 图片渲染（含过期占位图）
│       │   └── workspace/      # Workspace 子组件
│       │       ├── ChatSidebar.tsx  # 会话历史侧栏
│       │       └── ToolDock.tsx     # 工具坞
│       ├── constants/       # 常量
│       │   └── workspace.ts    # FEATURES：功能可用性的唯一来源
│       ├── hooks/           # 自定义 Hooks
│       │   ├── useSession.ts  # 会话状态管理
│       │   └── useTheme.ts    # 主题切换
│       ├── lib/             # 基础工具库
│       │   ├── authFetch.ts   # 认证 fetch 封装（业务接口通道）
│       │   ├── security.ts    # PII 脱敏 / 输入净化
│       │   ├── uid.ts         # ID 生成器
│       │   └── utils.ts       # className 合并等
│       ├── pages/           # 页面组件
│       │   ├── Workspace.tsx  # AI 对话工作区
│       │   └── Login.tsx      # 登录/注册
│       ├── services/        # API 服务层
│       │   ├── api.ts             # Axios 实例（认证接口通道）
│       │   ├── chatService.ts     # AI 对话服务
│       │   └── sessionService.ts  # 会话历史 CRUD
│       ├── store/           # Zustand 状态
│       │   ├── appStore.ts    # 全局应用状态
│       │   └── authStore.ts   # 认证状态
│       ├── types/           # 全局共享类型
│       ├── utils/           # 工具函数
│       ├── API.md           # 接口契约 + 消息类型说明
│       ├── App.tsx          # 路由
│       └── main.tsx         # 应用入口
│
└── go-backend/              # Go 后端
    ├── agent/               # Python 智能体服务（含 RAG 知识库，详见 agent/README.md）
    ├── config/              # 配置结构体 + 环境变量加载
    ├── controller/          # HTTP 处理器
    │   ├── auth_controller.go      # 用户认证
    │   ├── chat_controller.go      # AI 对话代理
    │   ├── session_controller.go   # 会话管理
    │   └── user_controller.go      # 用户信息
    ├── pkg/                 # 与业务无关的公共组件（刻意不依赖本项目其他包）
    │   └── storage/                # 文件存储抽象：local / oss 双驱动
    ├── service/             # 业务逻辑层
    │   ├── auth_service.go         # 认证逻辑
    │   ├── chat_service.go         # AI 对话代理（图片经 pkg/storage 落存储）
    │   └── session_service.go      # 会话管理
    ├── repository/          # 数据访问层
    │   ├── user_repo.go            # 用户数据
    │   └── session_repo.go         # 会话数据
    ├── model/               # 数据模型
    │   ├── entity/                 # 数据库表模型
    │   ├── request/                # API 请求体
    │   └── response/               # API 响应体
    ├── database/            # 数据库连接
    ├── middleware/          # 中间件（鉴权、CORS）
    ├── doc/                 # 设计与契约文档
    ├── scripts/             # 联调脚本
    ├── uploads/             # 用户上传图片
    ├── app.go               # 应用初始化
    ├── router.go            # 路由注册
    └── main.go              # 服务入口
```

## API 概览

所有接口以 `/api` 为前缀，详细文档见 [API.md](ColorAI/src/API.md)。

| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/health` | GET | 公开 | 服务健康检查 |
| `/api/auth/register` | POST | 公开 | 用户注册 |
| `/api/auth/login` | POST | 公开 | 用户登录 |
| `/api/auth/logout` | POST | Token | 用户登出 |
| `/api/user/profile` | GET | Token | 获取用户信息 |
| `/api/chat` | POST | Token | AI 对话 |
| `/api/sessions` | GET | Token | 获取会话列表 |
| `/api/sessions` | POST | Token | 创建新会话 |
| `/api/sessions/:id` | GET | Token | 获取会话详情 |
| `/api/sessions/:id` | DELETE | Token | 删除会话 |

### 鉴权说明

- 需要鉴权的接口在请求头携带 `Authorization: Bearer <token>`
- Token 存储在 Redis 中，有效期 7 天
- 前端有**两条请求通道**，都会自动注入 token，但用途不同：
  - **认证接口**（`/api/auth/*`）→ Axios 实例 `services/api.ts`，请求拦截器从 `localStorage` 读取
  - **业务接口**（`/api/chat`、`/api/sessions/*`）→ `authFetch`（`lib/authFetch.ts`），直接从 Zustand store 读取
- **401 处理（两条通道行为不同，别混淆）**：
  - Axios 通道 → 清除 `localStorage` 登录态并**跳转 `/login`**
  - `authFetch` 通道 → 清除本地登录态并抛出 `AuthRequiredError`，由业务层弹出**登录引导弹窗**（不跳转）
- `/workspace` **故意不设路由守卫**：允许未登录先浏览界面，只在真的要发请求时才引导登录。
  这样比一进页面就被弹去登录页体验好。

## 数据库表结构

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 用户 ID |
| username | VARCHAR(64) | 用户名 |
| phone | VARCHAR(20) UNIQUE | 手机号 |
| password_hash | VARCHAR(128) | 密码 SHA-256 哈希 |
| avatar | VARCHAR(255) | 头像 URL |
| created_at | DATETIME | 创建时间 |

### chat_sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 会话 ID |
| user_id | VARCHAR(64) | 所属用户 |
| title | VARCHAR(255) | 会话标题 |
| message_count | INT | 消息数量 |
| created_at | BIGINT | 创建时间戳 |
| updated_at | BIGINT | 更新时间戳 |

### chat_messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 消息 ID |
| session_id | VARCHAR(64) | 所属会话 |
| role | VARCHAR(16) | user / assistant |
| msg_type | VARCHAR(32) | text / correct |
| content | TEXT | 文本内容 |
| payload | TEXT | 扩展数据（JSON 字符串） |
| sort_order | INT | 消息排序 |
| created_at | BIGINT | 创建时间戳 |

> 知识库的三张表（`kb_chunks` / `kb_colors` / `kb_builds`）在 **PostgreSQL 的 `colorai_kb` schema** 下，
> 与上面这三张业务表不在同一个库，详见 [RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md)。

## 认证流程

1. 用户登录 → 后端生成随机 Token → 存入 Redis
2. 前端存储 Token 至 localStorage（通过 Zustand 持久化）
3. 请求受保护接口时，前端自动注入 `Authorization: Bearer {token}`
   （认证接口走 Axios 拦截器，业务接口走 `authFetch`）
4. 后端 `RequireAuth` 中间件从 Redis 校验 Token，解析用户信息写入 Gin Context

## 相关文档

- 接口契约 + 消息类型说明：[API.md](ColorAI/src/API.md) —— 前端渲染结果卡片的依据
- 智能体服务说明：[agent/README.md](go-backend/agent/README.md) —— 接口、内置工具、RAG 知识库、如何加工具
- RAG 知识库设计：[RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md) —— 决策依据 + 实测数据
- 智能体工具封装设计：[图片校色Tool封装设计.md](go-backend/doc/图片校色Tool封装设计.md) —— 含踩坑记录
- API 契约文档：[API 契约](go-backend/doc/API契约文档.md)
- 产品需求文档：[PRD](go-backend/doc/颜色视觉AI智能体PRD.md)
