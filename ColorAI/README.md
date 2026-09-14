# 曲泉AI — 前端应用

> 基于 AI 大模型的色彩智能体，提供智能对话与 5 大图像处理功能。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3.4 |
| 路由 | React Router DOM 7 |
| 状态管理 | Zustand 5 |
| PWA | vite-plugin-pwa |
| 图标 | Lucide React |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（自动代理 /api → localhost:3001）
npm run dev

# 类型检查
npm run check

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
src/
├── assets/              # 静态资源
├── components/          # 共享组件
│   └── workspace/       # Workspace 子组件
│       ├── ChatSidebar.tsx      # 会话历史侧栏
│       └── ToolDock.tsx         # 工具坞（功能标签 + 更多面板）
├── constants/           # 常量定义
│   └── workspace.ts     # 功能卡片、工具坞配置
├── hooks/               # 自定义 Hooks
│   ├── useSession.ts    # 会话状态管理（列表/消息/保存）
│   └── useTheme.ts      # 主题切换
├── lib/                 # 基础工具库
│   ├── authFetch.ts     # 全局认证 fetch 封装
│   ├── uid.ts           # 随机 ID 生成器
│   └── utils.ts         # cn() 等通用工具
├── pages/               # 页面组件
│   ├── Workspace.tsx    # AI 对话工作区（核心）
│   └── Login.tsx        # 登录/注册
├── services/            # API 服务层
│   ├── api.ts           # Axios 实例 + 拦截器
│   ├── colorService.ts  # 色彩处理 API（校色/取色/对比/转换）
│   ├── chatService.ts   # AI 对话服务（通过后端代理调用 LLM API）
│   └── sessionService.ts # 会话历史 CRUD
├── store/               # Zustand 状态
│   ├── appStore.ts      # 全局应用状态（校色结果/取色结果）
│   └── authStore.ts     # 认证状态（token/用户信息，持久化）
├── types/               # 全局共享类型
│   └── index.ts         # 色彩类型、API 响应、Message 类型等
├── utils/               # 工具函数
│   ├── colorConverter.ts # 色彩空间转换（HEX/RGB/HSL/CMYK/Lab/HSV）
│   └── workspace.ts     # 会话标题推断、消息过滤等
├── App.tsx              # 路由配置
├── main.tsx             # 入口
└── index.css            # 全局样式
```

## 核心功能模块

### AI 对话工作区（Workspace）

主交互入口，集成 5 大图像处理能力 + AI 大模型对话：

- **图片一键校正** — AI 智能白平衡还原真实色彩
- **智能取色器** — 点击图片获取多格式色值
- **色彩空间转换** — HEX / RGB / HSL / CMYK / Lab / HSV 实时互转
- **颜色相似度对比** — ΔE 专业色差量化评分
- **手机拍摄校色** — 还原人眼视觉真实颜色
- **自由对话** — 基于 AI 大模型的色彩问答

### 会话管理

- 会话列表侧栏（桌面端常驻 / 移动端抽屉）
- 会话切换 / 新建 / 删除（两步确认）
- 消息历史持久化至后端 MySQL
- 首次进入默认显示新会话欢迎页

### 认证体系

- Zustand + localStorage 持久化 token
- Axios 拦截器自动注入 Authorization header
- 401 响应自动清除登录态并跳转登录页
- Workspace 顶栏登录入口与用户菜单

## 开发代理

Vite 开发服务器自动将 `/api` 请求代理至 Go 后端（`localhost:3001`）：

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    }
  }
}
```

## 路由表

| 路径 | 页面 | 说明 |
|------|------|------|
| `/workspace` | AI 对话工作区 | 默认路由，未匹配路径重定向至此 |
| `/login` | 登录/注册 | 用户认证 |

## 路径别名

项目配置了 `@/` 别名指向 `src/`：

```ts
// tsconfig.json
paths: { "@/*": ["./src/*"] }
```

## 相关项目

- **Go 后端** — `../go-backend/`（Gin 框架，端口 3001）
  - 用户认证、会话管理、数据库操作
  - 启动时自动拉起 Python Agent
- **Python 智能体** — `../go-backend/Agent/`（LangGraph + FastAPI，端口 8000）
  - AI 智能对话、色彩处理工具
  - 随 Go 后端自动启动/停止

## 三层架构

```
前端 (React :5173) → Go 后端 (Gin :3001) → Python Agent (FastAPI :8000) → DeepSeek API
```

启动方式：只需启动 Go 后端，Python Agent 会自动随之启动：

```bash
cd ../go-backend
go run main.go
```

然后在另一个终端启动前端：

```bash
npm run dev
```
