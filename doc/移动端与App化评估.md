# 移动端 / H5 / App 化评估

> 评估日期：2026-09-08
> 评估对象：曲泉AI 色彩处理智能应用（React 18 + Vite 6 + TypeScript + Tailwind 3 + Express）

## 一、总体结论

**基础很好，转 H5 的剩余工作量不大，转 App（Capacitor）完全可行。**

移动端适配度评估为「中等偏上」——骨架已经是移动优先，但还差一层「App 化」的收尾。

当前技术栈（React + Vite + TypeScript + Tailwind + Vercel）非常利于这种迁移。

## 二、迁移路径

### 路径 1：H5 / PWA（成本最低，几乎不用改代码）

项目本来就是网页，H5 本质是移动端响应式适配。Tailwind 已经帮了大忙，主要工作是布局断点、触摸手势、移动端 UI 细节。

进一步可做成 PWA：加 `manifest.json` + service worker，用户可「添加到主屏幕」，有图标、可离线、全屏启动，体验接近原生 App，无需上架应用商店。

### 路径 2：原生 App（安卓 + iOS，推荐 Capacitor）

用 Capacitor 把现有 Vite 构建产物包一层 WebView，**100% 复用现有代码，零重写**。提供原生能力桥接（相机、文件、推送、本地存储等），对色彩工具类应用完全够用。

- 权衡：Capacitor 本质是 WebView 套壳，性能敏感场景（复杂 3D 图形、高频手势、深度调用系统底层）不如 React Native / Flutter 原生重写。但对「色彩处理 + AI」类工具应用，性能差异几乎无感，重写成本却高得多。

### 路径 3：微信小程序（如需）

走 Taro 或 uni-app 兼容「H5 + 小程序 + App」多端，需要一定程度的代码改造，等真正需要时再评估。

## 三、已经做好的 ✅

| 项 | 状态 |
|---|---|
| viewport meta | 已配置（`index.html:6`） |
| 响应式断点 | 已大量使用：`sm:` 103 处、`md:` 55 处、`lg:` 32 处 |
| 首页 Hero | 移动优先，`clamp()` 字号 + `lg:grid-cols` 单双列切换 |
| 登录页 | 居中 `max-w-md` 卡片，天然适配 |
| 工作台 Workspace | 适配最好的一页，`sm:` 变体 + 横向滚动列表 |
| 上传兜底 | 所有上传页都有 `<input type="file">`，不只是拖拽 |
| 取色器触控 | 已有 `onTouchMove` / `onTouchEnd`（`ColorPicker.tsx:377`） |
| 无障碍动效 | `index.css` 尊重 `prefers-reduced-motion` |

## 四、转 H5 / App 前需要补的 ⚠️

1. **PWA 缺失**
   没有 `manifest.json`、service worker、`theme-color`、`apple-touch-icon`。做「添加到主屏幕」或 Capacitor 打包都需要这套，优先级最高。

2. **刘海屏安全区**
   没有 `viewport-fit=cover` 和 `env(safe-area-inset-*)`，固定顶部导航和底部操作栏在 iPhone 刘海/底部横条上会被遮挡。

3. **hover 依赖（118 处）**
   部分「悬停才显示」的控件在触屏上不可达，需要审计哪些是功能性按钮、哪些只是装饰。

4. **拖拽文案**
   移动端拖拽无效，虽然有 file 兜底，但 UI 上「拖拽图片到此处」这类文案要改成「点击上传」。

5. **导航栏没有站点导航**
   `Navbar.tsx` 里桌面和移动端都没有任何页面导航链接，汉堡菜单里目前只有一个登录按钮，站点导航完全依赖首页 CTA。这可能是刻意极简，但移动端没有主导航入口值得确认。

6. **iOS 100vh 问题**
   `Workspace.tsx:750` 用 `h-screen`，iOS Safari 动态地址栏会裁切底部，建议改用 `100dvh`。

## 五、转 App 的关键架构点 🔑

后端是 **Vercel serverless（Express）**，前端用相对路径 `/api`（Vite 代理 + Vercel rewrite 同源）。核心服务（`src/services/api.ts`）目前**带 mock 数据兜底**（随机延迟 + 生成假图片）。

- **好消息**：App 可以先跑起来看 UI，不必先接真后端。
- **注意**：Capacitor 打包后 web 资源运行在 `capacitor://localhost`，不在 Vercel 域名下，`/api` 相对路径会失效。届时必须把 `baseURL` 改成公网绝对地址（如 `https://你的项目.vercel.app/api`），并在后端加 CORS。

### 相关文件索引

| 文件 | 说明 |
|---|---|
| `index.html` | viewport、字体、入口 |
| `vite.config.ts` | `/api` → `localhost:3001` 代理 |
| `vercel.json` | `/api` rewrite 到 serverless |
| `src/services/api.ts` | API 客户端 + mock 数据兜底 |
| `src/components/Navbar.tsx` | 导航栏（汉堡菜单内容缺失） |
| `src/pages/Workspace.tsx` | 工作台（`h-screen`，适配最好） |
| `src/pages/ColorPicker.tsx` | 取色器（已有触控支持） |

## 六、建议路径

1. **第一步（H5，工作量小）**
   响应式收尾 + PWA：补 manifest / service worker、安全区、`100dvh`、改拖拽文案、审计 hover 控件。上线即可当 H5 用。

2. **第二步（App）**
   确认 H5 体验 OK 后，用 Capacitor 打包安卓 / iOS，把 API 地址指向公网 + 配 CORS。

## 七、待办清单（按优先级）

- [ ] 补 PWA：`manifest.json` + service worker + `theme-color` + `apple-touch-icon`
- [ ] 安全区：`viewport-fit=cover` + `env(safe-area-inset-*)`
- [ ] 工作台 `h-screen` → `100dvh`
- [ ] 审计 118 处 hover 依赖，确认功能性控件在触屏可达
- [ ] 拖拽上传文案改为「点击上传」等移动端友好文案
- [ ] 确认 Navbar 是否需要补充站点导航
- [ ] App 化时：`baseURL` 改公网绝对地址 + 后端 CORS
