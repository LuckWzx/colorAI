# 曲泉AI — 前端应用

> 色彩处理智能应用：校色、取色、色彩转换、色差对比，基于 DeepSeek 大模型的专业色彩智能体。

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
│   ├── workspace/       # Workspace 子组件（已提取）
│   │   ├── ChatSidebar.tsx      # 会话历史侧栏
│   │   ├── ChatWelcome.tsx      # 欢迎首屏
│   │   ├── ComparisonBar.tsx    # 色差对比条
│   │   └── ToolDock.tsx         # 工具坞（功能标签 + 更多面板）
│   ├── Layout.tsx       # 页面布局壳
│   ├── Navbar.tsx       # 导航栏
│   └── Footer.tsx       # 页脚
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
│   ├── Home.tsx                # 首页
│   ├── Workspace.tsx           # AI 对话工作区（核心）
│   ├── Login.tsx               # 登录/注册
│   ├── Profile.tsx             # 个人中心
│   ├── Wallet.tsx              # 钱包
│   ├── ImageCorrection.tsx     # 图片校正
│   ├── ColorPicker.tsx         # 智能取色
│   ├── ColorConverterPage.tsx  # 色彩空间转换
│   ├── ColorCompare.tsx        # 颜色对比
│   ├── PhoneCorrection.tsx     # 手机拍摄校色
│   ├── Knowledge.tsx           # 知识问答
│   ├── ColorLibrary.tsx        # 色卡库
│   ├── Community.tsx           # 社区
│   ├── PartnerCooperation.tsx  # 商家合作
│   └── MerchantOnboarding.tsx  # 商家入驻
├── services/            # API 服务层
│   ├── api.ts               # Axios 实例 + 拦截器
│   ├── colorService.ts      # 色彩处理 API（校色/取色/对比/转换）
│   ├── deepseekService.ts   # DeepSeek 大模型对话
│   ├── knowledgeService.ts  # 知识库 API
│   └── sessionService.ts    # 会话历史 CRUD
├── shared/              # 共享类型（已废弃，合并至 types/）
├── store/               # Zustand 状态
│   ├── appStore.ts      # 全局应用状态（校色结果/取色结果）
│   ├── authStore.ts     # 认证状态（token/用户信息，持久化）
│   └── walletStore.ts   # 钱包状态
├── types/               # 全局共享类型
│   └── index.ts         # 色彩类型、API 响应、Message 类型等
├── utils/               # 工具函数
│   ├── colorConverter.ts  # 色彩空间转换（HEX/RGB/HSL/CMYK/Lab/HSV）
│   └── workspace.ts       # 会话标题推断、消息过滤等
├── App.tsx              # 路由配置
├── main.tsx             # 入口
└── index.css            # 全局样式
```

## 核心功能模块

### AI 对话工作区（Workspace）

主交互入口，集成了 5 大图像处理能力 + DeepSeek 大模型对话：

- **图片一键校正** — AI 智能白平衡还原真实色彩
- **智能取色器** — 点击图片获取多格式色值
- **色彩空间转换** — HEX / RGB / HSL / CMYK / Lab / HSV 实时互转
- **颜色相似度对比** — ΔE 专业色差量化评分
- **手机拍摄校色** — 还原人眼视觉真实颜色
- **自由对话** — 基于 DeepSeek 大模型的色彩问答

### 会话管理

- 会话列表侧栏（桌面端常驻 / 移动端抽屉）
- 自动保存（400ms 防抖）+ 离开兜底保存
- 会话切换 / 新建 / 删除（两步确认）
- 消息历史持久化至后端 MySQL

### 认证体系

- Zustand + localStorage 持久化 token
- `authFetch` 全局封装，自动注入 Authorization header
- 路由守卫（`RequireAuth`）保护受保护页面

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

| 路径 | 页面 | 权限 |
|------|------|------|
| `/` | 首页 | 公开 |
| `/login` | 登录/注册 | 公开 |
| `/workspace` | AI 对话工作区 | 公开 |
| `/profile` | 个人中心 | 需登录 |
| `/wallet` | 钱包 | 需登录 |
| `/image-correction` | 图片校正 | 公开 |
| `/color-picker` | 智能取色 | 公开 |
| `/color-converter` | 色彩空间转换 | 公开 |
| `/color-compare` | 颜色对比 | 公开 |
| `/phone-correction` | 手机拍摄校色 | 公开 |
| `/knowledge` | 知识问答 | 公开 |
| `/color-library` | 色卡库 | 公开 |
| `/community` | 社区 | 公开 |
| `/partner-cooperation` | 商家合作 | 公开 |
| `/merchant-onboarding` | 商家入驻 | 公开 |

## 路径别名

项目配置了 `@/` 别名指向 `src/`：

```ts
// tsconfig.json
paths: { "@/*": ["./src/*"] }
```

## 相关项目

- **Go 后端** — `../go-backend/`（Gin 框架，端口 3001）
- **Python 工具方** — 色彩处理微服务
