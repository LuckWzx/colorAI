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
- **HTTP 客户端**：Axios（`src/services` 统一封装）
- **图标**：Lucide React
- **后端**：Express 4 + TypeScript（API 服务，默认端口 `3001`）
- **AI 能力**：DeepSeek API（服务端代理，Key 不暴露给前端）
- **PWA**：vite-plugin-pwa（支持离线访问与桌面安装）
- **部署**：支持 Vercel Serverless（`api/index.ts` 为入口）

## 快速开始

### 环境要求

- Node.js 18+
- npm（或 pnpm / yarn）

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 DeepSeek API Key（申请地址：https://platform.deepseek.com/ ）：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 启动开发环境

```bash
# 同时启动前端（Vite）与后端（Express）
npm run dev

# 或分别启动
npm run client:dev   # 前端 http://localhost:5173
npm run server:dev   # 后端 http://localhost:3001
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
ColorAI/
├── api/                    # Express 后端
│   ├── routes/             # 路由：auth / color / knowledge / deepseek
│   ├── data/               # 内置知识问答 Mock 数据
│   ├── app.ts              # Express 应用（中间件、路由挂载、错误处理）
│   ├── server.ts           # 本地开发服务入口（端口 3001）
│   └── index.ts            # Vercel Serverless 部署入口
├── src/                    # React 前端
│   ├── components/         # 通用组件（Layout / Navbar / Footer 等）
│   ├── pages/              # 页面组件（含 Wallet 钱包页）
│   ├── services/           # API 服务层（color / knowledge / deepseek / session）
│   ├── store/              # Zustand 状态管理（auth / app / wallet）
│   ├── hooks/              # 自定义 Hooks（useTheme 等）
│   ├── utils/              # 工具函数（色彩转换等）
│   └── shared/             # 共享类型定义
├── public/uploads/         # 上传图片存储目录
├── doc/                    # 文档（PRD、移动端评估等）
└── vite.config.ts          # Vite 配置（含 /api 代理）
```

## API 概览

所有接口以 `/api` 为前缀，健康检查：`GET /api/health`。

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` `/login` `/logout` | POST | 用户认证（待实现） |
| `/api/color/correct` | POST | 图片一键校正（multipart 上传） |
| `/api/color/pick` | POST | 图片取色 |
| `/api/color/compare` | POST | 双图颜色相似度对比 |
| `/api/color/phone-correct` | POST | 手机照片校色 |
| `/api/knowledge/color-issues` | GET | 偏色问题问答（支持 `keyword` 过滤） |
| `/api/knowledge/photo-tips` | GET | 拍照技巧 |
| `/api/knowledge/shops` | GET | 附近商铺（支持 `city` 过滤） |
| `/api/knowledge/brands` | GET | 品牌大全（支持 `category` 过滤） |
| `/api/deepseek/chat` | POST | DeepSeek AI 对话（需配置 API Key） |

## 部署到 Vercel

项目已配置 `vercel.json` 与 Serverless 入口（`api/index.ts`），构建命令 `npm run build`。部署前请确保在 Vercel 项目中配置环境变量 `DEEPSEEK_API_KEY`。

## 相关文档

- 产品需求文档：[颜色视觉AI智能体PRD](doc/颜色视觉AI智能体PRD.md)
- 颜色视觉智能体设计：[颜色视觉智能体](doc/颜色视觉智能体.md)
- H5 改造方案：[H5改造实施方案](doc/H5改造实施方案.md)
- 移动端与 App 化评估：[移动端与App化评估](doc/移动端与App化评估.md)
- Python 工具方协议：[python工具方协议](doc/python工具方协议.md)
