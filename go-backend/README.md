# 曲泉AI — Go 后端服务

> 基于 Gin 框架的 RESTful API 服务，为前端提供色彩处理、AI 对话、会话管理、用户认证等能力。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Go 1.24 |
| Web 框架 | Gin 1.10 |
| 数据库 | MySQL（go-sql-driver） |
| 缓存 | Redis（go-redis v9） |
| 认证 | Redis Token 存储 |
| 环境变量 | godotenv |

## 快速开始

```bash
# 1. 复制环境变量配置
cp .env.example .env

# 2. 编辑 .env，填入数据库、Redis、LLM API Key 等配置

# 3. 运行数据迁移（建表 + 写入种子数据）
go run cmd/migrate/main.go

# 4. 启动服务（默认端口 3001）
go run main.go
```

## 项目结构

```
go-backend/
├── cmd/
│   └── migrate/
│       └── main.go          # 数据库迁移 + 种子数据导入
├── database/
│   ├── db.go                # MySQL 连接初始化
│   └── redis.go             # Redis 连接初始化
├── handlers/
│   ├── auth.go              # 用户注册/登录/登出
│   ├── color.go             # 色彩处理（校色/取色/对比/手机校色）
│   ├── chat.go              # AI 对话代理（当前接入 DeepSeek，可切换其他 LLM）
│   ├── knowledge.go         # 知识库数据查询
│   ├── session.go           # 会话历史 CRUD
│   └── user.go              # 用户信息
├── middleware/
│   ├── auth.go              # Token 鉴权中间件（Redis 校验）
│   └── cors.go              # CORS 跨域中间件
├── models/
│   └── models.go            # 统一数据模型定义
├── data/                    # 知识库 JSON 种子数据
│   ├── color_issues.json    # 拍照偏色解答
│   ├── photo_tips.json      # 拍照技巧
│   ├── shops.json           # 附近商铺
│   └── brands.json          # 工业胶品牌
├── uploads/                 # 用户上传图片存储
├── .env.example             # 环境变量模板
├── main.go                  # 服务入口 + 路由注册
├── go.mod
└── go.sum
```

## 环境变量

```bash
# 服务端口（默认 3001）
PORT=3001

# LLM API Key（当前接入 DeepSeek，服务端读取，不暴露给前端）
LLM_API_KEY=your_llm_api_key_here

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# Redis 配置（用于 Token 存储）
REDIS_ADDR=127.0.0.1:6379
REDIS_PASS=your_redis_password
```

## API 接口

### 健康检查

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 公开 | 服务健康检查 |

### 用户认证

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 用户注册（username + phone + password） |
| POST | `/api/auth/login` | 公开 | 手机号 + 密码登录，返回 Token |
| POST | `/api/auth/logout` | 需登录 | 登出，清除 Redis Token |

### 用户信息

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/user/profile` | 需登录 | 获取当前用户信息 |

### 色彩处理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/color/pick` | 公开 | 图片取色（坐标 → RGB/HEX） |
| POST | `/api/color/correct` | 需登录 | 图片一键校正（白平衡/亮度/对比度） |
| POST | `/api/color/compare` | 需登录 | 两张图片颜色对比（ΔE 色差） |
| POST | `/api/color/phone-correct` | 需登录 | 手机拍摄视觉校色 |

### AI 对话

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/chat` | 需登录 | 发送对话消息，代理调用 LLM API（当前接入 DeepSeek） |

### 会话管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/sessions` | 需登录 | 获取会话列表（仅元数据） |
| POST | `/api/sessions` | 需登录 | 新建空会话 |
| GET | `/api/sessions/:id` | 需登录 | 获取会话详情（含消息历史） |
| PUT | `/api/sessions/:id` | 需登录 | 全量保存会话（事务：删旧消息 → 插入新消息） |
| DELETE | `/api/sessions/:id` | 需登录 | 删除会话及其所有消息 |

### 知识库

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/knowledge/color-issues` | 公开 | 拍照偏色解答列表 |
| GET | `/api/knowledge/photo-tips` | 公开 | 拍照技巧列表 |
| GET | `/api/knowledge/shops` | 公开 | 附近商铺列表 |
| GET | `/api/knowledge/brands` | 公开 | 工业胶品牌列表 |

## 数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 用户 ID |
| username | VARCHAR(64) | 用户名 |
| phone | VARCHAR(20) UNIQUE | 手机号 |
| password_hash | VARCHAR(128) | 密码 SHA-256 哈希 |
| avatar | VARCHAR(255) | 头像 URL |
| created_at | BIGINT | 创建时间戳 |

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
| msg_type | VARCHAR(32) | text / correct / pick / compare / convert / phone |
| content | TEXT | 文本内容 |
| payload | JSON | 扩展数据（correctResult / compareResult 等） |
| sort_order | INT | 消息排序 |
| created_at | BIGINT | 创建时间戳 |

### 知识库表
- `color_issues` — 拍照偏色解答
- `photo_tips` — 拍照技巧
- `shops` — 附近商铺
- `brands` — 工业胶品牌

## 认证流程

1. 用户登录 → 后端生成随机 Token → 存入 Redis（`token:{token}` → `user_id|username|phone`）
2. 前端存储 Token 至 localStorage（通过 Zustand 持久化）
3. 请求受保护接口时，前端通过 `authFetch` 自动注入 `Authorization: Bearer {token}`
4. 后端 `RequireAuth` 中间件从 Redis 校验 Token，解析用户信息写入 Gin Context

## 数据迁移

```bash
# 从 data/ 目录的 JSON 文件导入知识库种子数据
# 同时创建会话系统表结构 + 写入 mock 会话数据
go run cmd/migrate/main.go
```

迁移内容：
- 建表：`users`、`chat_sessions`、`chat_messages`、`color_issues`、`photo_tips`、`shops`、`brands`
- 种子数据：4 类知识库 JSON + 3 个 mock 会话（含完整消息历史）

## 相关项目

- **前端应用** — `../ColorAI/`（React + Vite，端口 5173）
- **Python 工具方** — 色彩处理微服务
