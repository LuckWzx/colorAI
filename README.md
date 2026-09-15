# 曲泉AI (ColorAI)

> 基于 AI 大模型的色彩智能体，面向设计师、摄影师、印刷从业者及色彩爱好者，提供智能对话与图像处理功能。

核心价值：让色彩更精准，让专业色彩处理触手可及。

## 功能特性

| 功能 | 说明 | 路由 |
|------|------|------|
| 首页 | 品牌展示 + 功能导航卡片 | `/` |
| AI 聊天工作台 | AI 色彩对话，集成图片校色、取色、转换、对比等工具，会话历史管理 | `/workspace` |
| 登录 / 注册 | 用户认证 | `/login` |

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
| **AI 智能体** | |
| 框架 | LangGraph + FastAPI |
| LLM | DeepSeek API |
| 端口 | 8000 |

## 三层架构

```
前端 (React :5173) → Go 后端 (Gin :3001) → Python Agent (FastAPI :8000) → DeepSeek API
```

- **前端**：UI 渲染、用户交互
- **Go 后端**：用户认证、会话管理、数据库操作、代理转发
- **Python 智能体**：语义分析、工具选择、LLM 调用、工具执行

## 快速开始

### 环境要求

- Node.js 18+
- Go 1.21+
- Python 3.10+（用于智能体服务）
- MySQL 8.0+
- Redis 6+

### 安装依赖

```bash
# 前端
cd ColorAI
npm install

# 后端
cd ../go-backend
go mod tidy

# Python 智能体（如有需要）
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

# Python 智能体服务地址
AGENT_URL=http://localhost:8000

# LLM API Key（当前接入 DeepSeek）
LLM_API_KEY=your_llm_api_key_here

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# Redis 配置
REDIS_ADDR=127.0.0.1:6379
REDIS_PASS=your_redis_password
```

### 启动开发环境

只需启动 Go 后端，Python Agent 会自动随之启动：

```bash
# 终端 1: 启动 Go 后端（自动拉起 Python Agent）
cd go-backend
go run main.go       # http://localhost:3001
```

```bash
# 终端 2: 启动前端
cd ColorAI
npm run dev          # http://localhost:5173
```

开发模式下 Vite 会将 `/api` 请求代理到 `http://localhost:3001`。

## 项目结构

```
colorAI/
├── ColorAI/                 # React 前端
│   └── src/
│       ├── components/      # 共享组件
│       │   └── workspace/   # Workspace 子组件
│       │       ├── ChatSidebar.tsx  # 会话历史侧栏
│       │       └── ToolDock.tsx     # 工具坞
│       ├── hooks/           # 自定义 Hooks
│       │   ├── useSession.ts  # 会话状态管理
│       │   └── useTheme.ts    # 主题切换
│       ├── lib/             # 基础工具库
│       │   ├── authFetch.ts   # 认证 fetch 封装
│       │   └── uid.ts         # ID 生成器
│       ├── pages/           # 页面组件
│       │   ├── Workspace.tsx  # AI 对话工作区
│       │   └── Login.tsx      # 登录/注册
│       ├── services/        # API 服务层
│       │   ├── chatService.ts     # AI 对话服务
│       │   └── sessionService.ts  # 会话历史 CRUD
│       ├── store/           # Zustand 状态
│       │   ├── appStore.ts    # 全局应用状态
│       │   └── authStore.ts   # 认证状态
│       ├── types/           # 全局共享类型
│       └── utils/           # 工具函数
│
└── go-backend/              # Go 后端
    ├── agent/               # Python 智能体服务
    ├── config/              # 配置结构体 + 环境变量加载
    ├── controller/          # HTTP 处理器
    │   ├── auth_controller.go      # 用户认证
    │   ├── chat_controller.go      # AI 对话代理
    │   └── session_controller.go   # 会话管理
    ├── service/             # 业务逻辑层
    │   ├── auth_service.go         # 认证逻辑
    │   ├── chat_service.go         # AI 对话代理
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
- 前端 Axios 拦截器自动从 localStorage 读取 token 并注入请求头
- 后端返回 401 时，前端自动清除登录态并跳转到登录页

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
| payload | JSON | 扩展数据 |
| sort_order | INT | 消息排序 |
| created_at | BIGINT | 创建时间戳 |

## 认证流程

1. 用户登录 → 后端生成随机 Token → 存入 Redis
2. 前端存储 Token 至 localStorage（通过 Zustand 持久化）
3. 请求受保护接口时，前端通过 `authFetch` 自动注入 `Authorization: Bearer {token}`
4. 后端 `RequireAuth` 中间件从 Redis 校验 Token，解析用户信息写入 Gin Context

## 相关文档

- API 接口文档：[API.md](ColorAI/src/API.md)
- 产品需求文档：[PRD](go-backend/doc/颜色视觉AI智能体PRD.md)
- API 契约文档：[API 契约](go-backend/doc/API契约文档.md)
