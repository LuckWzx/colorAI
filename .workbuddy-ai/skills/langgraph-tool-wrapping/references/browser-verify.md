# 用 agent-browser 做浏览器端验证（改前端后必做）

前置：前端 dev server 在 5173 跑着，后端在 3001 跑着（起法见 SKILL.md §六）。
本机已装 `agent-browser`，Chromium 在 `~/.agent-browser/browsers`。

## 三条坑 —— 共同根因是同一个：状态只在「一次 bash 调用」内有效

1. **状态不跨 bash 调用保持** —— 上一次 `open` 的页面，下一次调用里 snapshot 会是
   `(no interactive elements)`、screenshot 是白屏；**单独发一个 `eval`（没有同调用的 `open`）
   会直接挂住不返回**，表现为 bash 超时 SIGTERM、零输出 —— 别以为是脚本写错了。
   **必须把「open → 登录 → 操作 → 截图」全写在同一个 bash 调用里。**

2. **ref（`e3` 这种）不跨调用存活** —— 报 `✗ Unknown ref: e6`。
   要在同一次调用里先 `snapshot -i > /tmp/s.txt`，再解析 ref：

```bash
REF=$(grep 'cursor:pointer' /tmp/s.txt | head -1 | sed 's/.*\[ref=\(e[0-9]*\)\].*/\1/')
agent-browser click "$REF"
```

3. **不带登录直接 `open /workspace`，页面外壳照常渲染（工具坞都在），但所有 `/api/*` 都是 401**，
   前端只显示一句含糊的「**AI 服务暂时不可用**」—— 很容易误判成后端挂了。
   **判据：看 Go 日志里是不是 401**（而不是 500/超时）。
   注意：**在同一次 bash 调用内** localStorage 是**保留**的（`open login` → `eval` 写入 token
   → `open workspace` 能正常带鉴权，已实测），所以不用每次调用都重新登录 ——
   但一旦跨了 bash 调用就全没了。**登录步骤必须和后续操作同一次调用。**

## 登录本项目的固定套路

账号 `testuser` / `13800138000` / `test123`。两种方式，**优先用第 2 种**
（不用点表单，不受按钮 ref / 自动填充干扰）：

```bash
# 方式 1：点表单
agent-browser open http://localhost:5173/login
agent-browser type "input[type=tel]" "13800138000"
agent-browser type "input[type=password]" "test123"
agent-browser click "button[type=submit]"        # 注意不是 e8，ref 会失效
```

```bash
# 方式 2：直接打 API 拿 token 再写进 localStorage（推荐）
agent-browser open http://localhost:5173/login
cat <<'JS' | agent-browser eval --stdin
(async () => {
  const r = await fetch('/api/auth/login', { method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ phone:'13800138000', password:'test123' }) });
  const d = await r.json();
  localStorage.setItem('colorai_auth', JSON.stringify({
    state: { user: d.user, token: d.token, isAuthenticated: true }
  }));
  return 'TOKEN_OK';
})()
JS
agent-browser open http://localhost:5173/workspace
```

⚠️ `colorai_auth` 的持久化格式是 zustand 的 `{state:{...}}`，**不要写 `version` 字段**：
store 没声明 `version`（即 `undefined`），而 zustand 的判据是
`typeof v.version === 'number' && v.version !== options.version` —— 写了 `version: 0`
反而会命中「版本不匹配且无 migrate」的分支，persisted state 被丢弃、表现为登录态读不出来。

**多行 JS 一律走 `--stdin` + heredoc**（`cat <<'JS' | agent-browser eval --stdin`）：
引号里的 `$`、反引号、换行全靠 shell 转义太容易出错，heredoc 用 `'JS'` 引起来可以原样传入。

## 上传图片走快捷工具

`input[type=file]` 有两个，**第一个是主图**：

```bash
agent-browser upload "input[type=file]" "<绝对路径>/testimage.jpg"
agent-browser click "textarea" && agent-browser press Enter
```

## 截图的两个坑

**消息列表是内部滚动容器，`screenshot --full` 抓不到下面**，要手动滚：

```bash
agent-browser eval "const el=[...document.querySelectorAll('*')].find(n=>n.scrollHeight>n.clientHeight+200&&n.clientHeight>200); el.scrollTop=el.scrollHeight; 'ok'"
```

**更常见的翻车点：目标元素所在的行比视口还高**（比如用户消息 = 320px 高的图 + 文字气泡）。
此时对**整行** `scrollIntoView({block:'center'})`，文字气泡仍会被挤到折叠线以下，
截出来的图和「什么都没改」时一模一样。
**要把目标元素本身滚进视野**：`bubble.scrollIntoView({block:'center'})`。
判据：`md5sum` 两张对比图 —— 若字节数几乎相同/哈希相同，说明**根本没截到变化区域**，别急着下结论。

`screenshot` 支持 `screenshot [selector] [path]` 显式给路径；路径写 `D:/tmp/...`，
**别写 `/tmp/...`** —— Git Bash 的 `/tmp` 不是 Windows 的 `C:\tmp`。

## 断言用 eval 比看截图可靠

截图只能肉眼看，eval 能直接拿字符串：

```bash
agent-browser eval "JSON.stringify({标题:[...document.querySelectorAll('h4')].map(h=>h.textContent), 图:[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>s.includes('corr'))})"
```

**别忘了查 console**：`agent-browser console`，React 渲染错误会在这里。
任务结束务必 `agent-browser close`。

## 改 CSS / 布局时：用 A/B 原地注入证明「是这个改动起的作用」

只量「改完之后对不对」是不够的 —— 数字对也可能是别的原因凑巧。
**正确做法是同一个 DOM 节点上量两次**：先量修复后的几何，再把那条 CSS 属性**内联改回旧值**
（等价于修复前），量第二次，然后恢复。这样得到的 delta 才是这个改动本身的贡献。

以「用户消息气泡没紧靠右」为例（外层 `max-w-[85%]` 的宽度由最宽子元素——图片——决定，
所以 `inline-block` 气泡贴在容器**左**边缘；修法是套一层 `flex justify-end`）：

```bash
cat <<'JS' | agent-browser eval --stdin
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const items = [...document.querySelectorAll('div.cursor-pointer')]
    .filter(el => /条消息/.test(el.textContent||''));      // 侧栏会话条目
  items[0].click();
  let row = null;
  for (let t = 0; t < 24; t++) {                            // 等 switchSession 拉完
    await sleep(300);
    row = [...document.querySelectorAll('div.flex.justify-end.animate-fade-in-up')]
      .find(r => r.querySelector('img.object-contain') && r.querySelector('div.inline-block'));
    if (row) break;
  }
  if (!row) return 'NO_ROW';

  const bubble    = row.querySelector('div.inline-block');
  const container = row.firstElementChild;                  // max-w-[85%] 那层
  const wrap      = bubble.parentElement;                   // flex justify-end 那层
  bubble.scrollIntoView({ block:'center' });                // 滚气泡本身，不是 row
  await sleep(400);

  const cr = container.getBoundingClientRect();
  const brFixed = bubble.getBoundingClientRect();

  wrap.style.justifyContent = 'flex-start';                 // ← 模拟修复前
  const brOld = bubble.getBoundingClientRect();
  wrap.style.justifyContent = '';                           // ← 恢复

  return JSON.stringify({
    容器宽: +cr.width.toFixed(1), 气泡宽: +brFixed.width.toFixed(1),
    右边缘差_修复后: +(cr.right - brFixed.right).toFixed(1),
    右边缘差_修复前: +(cr.right - brOld.right).toFixed(1),
    气泡内文字对齐: getComputedStyle(bubble).textAlign      // 应为 start
  });
})()
JS
```

实测输出：容器宽 426.2 / 气泡宽 124（说明容器确实被图片撑宽，**这是 bug 成立的前提**），
`右边缘差_修复后 = 0`、`右边缘差_修复前 = 302.2` → **302.2px → 0px**，结论无歧义。
若两者都是 0，说明这条消息的容器宽度就等于气泡宽度（没图 / 图比文字窄），**这次测量无效**，换一条消息。

顺手 `气泡内文字对齐: start` 可以验证你没有偷懒用 `text-right` —— `text-align` 会继承进气泡内部，
多行文字会被一起右对齐（单行看不出来，多行才露馅）。

**同一手法可以出「修复前/修复后」对比图**（给人看的时候很有说服力）：把 `window.__wrap`
存到全局，截一张；内联改成旧值，再截一张；最后恢复。

```bash
agent-browser screenshot "D:/tmp/align-A-fixed.png"
cat <<'JS' | agent-browser eval --stdin >/dev/null
(() => { window.__wrap.style.justifyContent = 'flex-start'; return 'patched'; })()
JS
agent-browser screenshot "D:/tmp/align-B-old.png"
cat <<'JS' | agent-browser eval --stdin
(() => { window.__wrap.style.justifyContent = ''; return 'restored -> ' + getComputedStyle(window.__wrap).justifyContent; })()
JS
md5sum /d/tmp/align-A-fixed.png /d/tmp/align-B-old.png   # 必须不同，相同=没截到变化区
```

## 做全屏浮层（弹窗 / 灯箱 / 抽屉）时：先查祖先有没有 transform

**症状**：`fixed inset-0` 的浮层不铺满视口 —— 被限制在某个卡片 / 消息行内部，或整体偏移。

**根因**：`position: fixed` 的包含块是**视口**；但只要**任一祖先**带
`transform` / `filter` / `backdrop-filter` / `will-change` / `contain: paint|layout`，
包含块就变成**那个祖先**。

本项目最容易踩的是 **`animate-fade-in-up`**（消息卡片根节点几乎都带）：

```js
// tailwind.config.js
"fade-in-up": "fadeInUp 0.45s ease-out both"        // ← both = animation-fill-mode: both
fadeInUp: { "0%": {transform:"translateY(12px)"}, "100%": {transform:"translateY(0)"} }
```

`both` 让元素在动画结束后**保留** 100% 帧的 `transform: translateY(0)`，
而 **`translateY(0)` 不等于 `none`** —— 照样创建包含块。

→ 所以浮层**必须**把状态提到页面顶层（`Workspace` 根部）渲染，
不能塞进消息卡片。同目录的摄像头弹窗 / 登录引导弹窗就是这么做的。

⚠️ 别误判成 `.glass-card`：它是干净的（`bg-brand-surface border shadow-card`，
**无** `backdrop-filter`）。真正的原因是上面那个动画。

**怎么证**（比肉眼看截图可靠）：

```js
const dlg = document.querySelector('[role=dialog][aria-modal=true]');
const r = dlg.getBoundingClientRect();
({ 铺满视口: Math.abs(r.width-innerWidth) < 2 && Math.abs(r.height-innerHeight) < 2,
   rect: {w:+r.width.toFixed(1), h:+r.height.toFixed(1), top:+r.top.toFixed(1)},
   视口: {w:innerWidth, h:innerHeight} })
```

实测（2026-09-24 图片灯箱）：`rect 1258×566` vs `视口 1258×566` → 铺满。
若被祖先劫持，会看到 `top/left` 非 0，或尺寸明显小于视口。

**顺带两条**：

- 浮层要锁 body 滚动：`document.body.style.overflow='hidden'`，cleanup 里**还原成原值**
  （先存 `prev`，别无条件清空）—— 否则会踩掉别的浮层留下的锁。
- 「点图片本身 = 关闭」这种交互（对齐微信相册）**不要**给 `<img>` 加 `stopPropagation`，
  让它冒泡到遮罩的 onClick 即可；`cursor: zoom-out` 是给用户的暗示。
