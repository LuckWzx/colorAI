# 曲泉AI (ColorAI)

曲泉AI是一款专注于色彩处理的智能应用，面向设计师、摄影师、印刷从业者、工业胶水行业人员及色彩爱好者，提供**图片一键校色、智能取色、色彩空间转换、颜色相似度对比、手机拍摄校色**等核心功能，并附带色彩知识问答、色彩社区、品牌色库等增值服务。

> 核心价值：让色彩更精准，让专业色彩处理触手可及。

## 功能特性

| 功能 | 说明 | 路由 |
|------|------|------|
| 首页 | 品牌展示 + 9 大功能导航卡片 | `/` |
| 图片一键校正 | 上传图片 → AI 校正 → 原图/校正图对比预览 → 下载 | `/image-correction` |
| 智能取色器 | 校正后图片点击取色，输出 HEX/RGB/HSL/CMYK/Lab/HSV 多格式色值 | `/color-picker` |
| 色彩空间转换 | 色值格式自动识别，6 种色彩空间同步互转 | `/color-converter` |
| 颜色相似度对比 | 双图主色提取，ΔE2000 色差 + 相似度评分 | `/color-compare` |
| 手机拍摄校色 | 手机照片视觉色彩校正 | `/phone-correction` |
| 色彩知识问答 | 偏色原因 / 拍照技巧 / 附近商铺 / 品牌大全 | `/knowledge` |
| 色彩社区 | 讨论发帖、交流分享 | `/community`、`/start-discussion` |
| 品牌色库 | 品牌色号检索与详情浏览 | `/color-library` |
| 商家入驻 / 合作 | 商家入驻与合作伙伴入口 | `/merchant-onboarding`、`/partner-cooperation` |
| 趋势报告 | 色彩趋势资讯 | `/trend-report` |
| AI 聊天工作台 | AI 色彩对话，会话历史管理 | `/workspace` |
| 登录 / 个人中心 | 用户认证与个人资料 | `/login`、`/profile` |
| 钱包 | 账户余额、消费账单（需登录） | `/wallet` |

## 技术栈

- **前端**：React 18 + TypeScript + Vite 6
- **样式**：Tailwind CSS 3 + CSS Variables（深色模式 + 磨砂玻璃拟态设计）
- **路由**：React Router 7
- **状态管理**：Zustand 5
- **HTTP 客户端**：Axios（`src/services` 统一封装，自动携带 Bearer token）
- **图标**：Lucide React
- **后端**：Go + Gin（API 服务，默认端口 `3001`）
- **数据库**：MySQL 8.0（阿里云 ECS）
- **缓存/会话**：Redis（Token 存储，TTL 7 天）
- **AI 能力**：LLM API（服务端代理，当前接入 DeepSeek，Key 不暴露给前端）
- **PWA**：vite-plugin-pwa（支持离线访问与桌面安装）

## 快速开始

### 环境要求

- Node.js 18+
- Go 1.21+
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
```

### 配置环境变量

环境变量统一在 Go 后端目录管理：

```bash
cd go-backend
cp .env.example .env
```

编辑 `go-backend/.env`，填入实际值：

```env
# 服务端口
PORT=3001

# LLM API Key（当前接入 DeepSeek，服务端读取，不暴露给前端）
# 申请地址: https://platform.deepseek.com/
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

需要分别启动前端和后端（两个终端）：

```bash
# 终端 1: 启动前端
cd ColorAI
npm run dev          # http://localhost:5173
```

```bash
# 终端 2: 启动 Go 后端
cd go-backend
go run main.go       # http://localhost:3001
```

开发模式下 Vite 会将 `/api` 请求代理到 `http://localhost:3001`。

### 构建与检查

```bash
npm run build    # 类型检查 + 生产构建
npm run check    # 仅 TypeScript 类型检查
npm run lint     # ESLint 检查
```

## 项目结构

```
colorAI/
├── ColorAI/        # React 前端（详见 ColorAI/README.md）
└── go-backend/     # Go 后端（详见 go-backend/README.md）
```

## API 概览

所有接口以 `/api` 为前缀，健康检查：`GET /api/health`。

| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/auth/register` | POST | 公开 | 用户注册（手机号 + 密码） |
| `/api/auth/login` | POST | 公开 | 用户登录，返回 Redis Token |
| `/api/auth/logout` | POST | Token | 用户登出，删除 Redis Token |
| `/api/user/profile` | GET | Token | 获取当前用户信息 |
| `/api/color/pick` | POST | 公开 | 图片取色 |
| `/api/color/correct` | POST | Token | 图片一键校正（需登录） |
| `/api/color/compare` | POST | Token | 双图颜色相似度对比（需登录） |
| `/api/color/phone-correct` | POST | Token | 手机照片校色（需登录） |
| `/api/knowledge/color-issues` | GET | 公开 | 偏色问题问答（支持 `keyword` 过滤） |
| `/api/knowledge/photo-tips` | GET | 公开 | 拍照技巧 |
| `/api/knowledge/shops` | GET | 公开 | 附近商铺（支持 `city` 过滤） |
| `/api/knowledge/brands` | GET | 公开 | 品牌大全（支持 `category` 过滤） |
| `/api/chat` | POST | Token | AI 对话（需登录，当前接入 DeepSeek） |
| `/api/sessions` | GET | Token | 获取当前用户的会话列表 |
| `/api/sessions` | POST | Token | 创建新会话 |
| `/api/sessions/:id` | GET | Token | 获取单个会话详情（含消息列表） |
| `/api/sessions/:id` | PUT | Token | 更新会话（标题、消息等） |
| `/api/sessions/:id` | DELETE | Token | 删除会话 |

### 鉴权说明

- 需要鉴权的接口在请求头携带 `Authorization: Bearer <token>`
- Token 存储在 Redis 中，有效期 7 天
- 前端 Axios 拦截器自动从 localStorage 读取 token 并注入请求头
- 后端返回 401 时，前端自动清除登录态并跳转到登录页

## 相关文档

- 前端 README：[ColorAI/README.md](ColorAI/README.md)
- 后端 README：[go-backend/README.md](go-backend/README.md)
- 产品需求文档：[PRD](ColorAI/doc/颜色视觉AI智能体PRD.md)
- API 契约文档：[API 契约](ColorAI/doc/API契约文档.md)
