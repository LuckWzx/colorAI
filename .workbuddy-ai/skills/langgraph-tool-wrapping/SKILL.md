---
name: langgraph-tool-wrapping
description: 在 ColorAI（曲泉AI）项目里把第三方 HTTP 接口封装成 LangGraph tool，并打通「前端 → Go → Agent → tool」全链路的完整流程。当用户要求「把 XX 接口封装成 tool」「实现某个 color_tools 工具」「跑通某条链路」「联调」时使用。
agent_created: true
---

# 在 ColorAI 里实现一个工具并打通全链路

三层架构：React/Vite(:5173) → Go/Gin(:3001) → Python FastAPI/LangGraph(:8000) → DeepSeek。
`image_correction`（一键校色）是**目前唯一已实现**的工具，也是完整样板。
其余 4 个能力（`color_extraction` / `color_comparison` / `color_conversion` / `phone_correction`）
**尚未实现，且已从工具列表移除**（不是 stub 占位）—— 原因见硬规则 7，别急着加回去。

## 先读什么

1. `go-backend/doc/图片校色Tool封装设计.md` —— **完整设计稿 + 实测记录，最佳模板**
2. `go-backend/doc/Color_Correction.md` —— 接口原始文档
3. `go-backend/doc/python工具方协议.md` —— error_code 约定
4. `go-backend/agent/app/tools/color_tools.py` —— 工具实现
5. `go-backend/agent/app/core/agent.py` —— `TOOL_TYPE_MAPPING` / `FEATURE_TOOL_MAPPING` / `_extract_tool_result`
6. `go-backend/service/chat_service.go` + `storage.go` —— Go 侧收图换 URL

## 七条硬规则（全是踩过的坑）

1. **tool 参数不能是 base64。** tool 参数由 LLM 生成（文本 token），几 MB 的 base64
   不可能被复述。**传 URL**，图片字节由 tool 自己 `httpx.get` 下载。
2. **业务失败不要用异常。** 例如校色的 `passed=false` 是 HTTP 200 的正常分支。
   必须返回 `success: True` + 业务字段，否则 `_extract_tool_result` 会丢弃结果、
   退化成纯文本回复（它要求 `parsed.get("success")` 为真）。
3. **可以返回 `dict`。** LangGraph `ToolNode` 会对非字符串返回值做
   `json.dumps(..., ensure_ascii=False)`（`langgraph/prebuilt/tool_node.py` 的
   `msg_content_output`），`ToolMessage.content` 因此是合法 JSON，中文不乱码。
4. **`httpx` 默认不跟随重定向**（和 `requests` 相反）。OSS / CDN 的图片 URL 常有跳转，
   必须显式 `follow_redirects=True`，否则拿到 302 空 body。
5. **只对超时 / 5xx 重试，4xx 不重试。** 4xx 是请求本身有问题，重试没意义；
   校色接口单次 ~6-10s，白等一轮还会把真实原因盖成超时。
6. **图片 URL 只能通过「文本」交给 LLM。** 绝不能塞进 `HumanMessage` 的
   `image_url` content part —— 见下面「Agent 侧」一节。
7. **未实现的工具绝不能注册进 `get_all_tools()`，也不能写进 `SYSTEM_PROMPT`。**
   对 LLM 来说，一个返回 `{"success": true, ...}` 的 stub 和真实工具没有区别 ——
   它会照用，并把写死的假数据包装成专业结论（实测：点「智能取色」返回
   `#FF5733/#33FF57/#3357FF` 这些 stub 里写死的色值，LLM 还配了
   「主色调为橙红，属于暖色系，视觉上偏活泼」的分析，**用户无法分辨真假**）。
   正确做法：删掉 stub → 只注册已实现的 → `SYSTEM_PROMPT` 只宣传已上线能力，
   并显式列出未上线的 + 禁止「编造数值 / 用别的工具冒充 / 声称已完成」。
   然后**必须验证**：`feature=pick` 应返回 `type=text` + `metadata=null`，
   而不是 `type=pick` + 编造的 metadata。

## 一、Tool 层（`agent/app/tools/color_tools.py`）

```
CorrectionError(code, message)      # 带 errorCode 的内部异常，统一错误出口
_extract_api_error(resp)            # 取接口自己的错误体 {"error": "..."}，直接给用户
_download_image(url) -> (bytes, filename, content_type)
_call_correction_api(...) -> dict   # 重试在这里
_normalize_xxx_response(raw) -> dict  # 归一化成前端契约，字段名 camelCase
@tool def xxx(...) -> dict          # 只做编排，try/except 收敛
```

**配置放 `agent/app/config.py`（走 `settings`），不要写模块常量** —— 切环境只改 `.env`。
现有：`CORRECTION_API_URL` / `CORRECTION_TIMEOUT` / `CORRECTION_RETRY` / `CORRECTION_DOWNLOAD_TIMEOUT`。

**返回字段必须逐字段对齐** `ColorAI/src/types/index.ts` 的前端类型，见 `ColorAI/src/API.md`。

## 二、Go 侧（收图落盘换 URL）

`service/storage.go` 提供 `Storage` 接口 + `localStorage` 实现。**图片永不进入 Agent**：

```
前端 dataURL → chat_service.resolveImages() → 落盘 uploads/chat/yyyy/MM/dd/<ts>_<hex>.jpg
             → 拼成 {PUBLIC_BASE_URL}{UploadURLPrefix}/{key} → 只把 URL 传给 Agent
```

要点：
- **落盘失败要直接返回错误，不要静默降级** —— 否则 tool 拿不到图，用户看到莫名其妙的失败
- **静态路由与存储前缀必须共用常量**：`router.go` 用 `service.UploadURLPrefix`，
  目录用 `cfg.Storage.LocalDir`。两处各自硬编码会漂移
- `SaveDataURL` 对已经是 `http(s)://` 的输入**原样返回**，保证幂等（前端复用历史消息时会带 URL）
- 加 `MAX_UPLOAD_BYTES` 上限（默认 10MB），base64 膨胀 1/3，JSON 请求体不设限容易被巨图打爆内存
- 切 OSS 只改 `PUBLIC_BASE_URL` + 新增一个 `Storage` 实现，调用方零改动

## 三、Agent 侧（`agent/app/core/agent.py`）

**① `feature` 非空时确定性短路，不让 LLM 选工具：**

```python
FEATURE_TOOL_MAPPING: dict[str, tuple[str, str]] = {
    "correct": ("image_correction", "image_url"),   # feature: (工具名, 图片参数名)
}
```
**只登记「已实现且图片参数是 URL」的工具** —— 未实现的不但要跳过登记，还**不能注册**
（硬规则 7）。登记顺序：实现 → `get_all_tools()` 注册 → 这里登记。

短路实现：手工补一对 `(AIMessage.tool_calls, ToolMessage)`（ToolMessage 必须挂在带
`tool_calls` 的 AIMessage 后面才合法），然后用**不带 tools 的 `self.llm`** 生成总结 ——
这样 LLM 拿不到工具、不会重复调用。实测 DeepSeek 接受「带 `role: tool` 消息但不传
`tools` 参数」的请求。

**② 图片以 URL 形式随文本给 LLM，不要注入 `image_url` content part：**

```python
content = content + "\n\n[用户上传的图片 URL]\n" + "\n".join(f"- {u}" for u in images)
```
原因：tool 入参是 URL，而 LLM 只能通过文本生成 tool 参数，URL 必须在文本里。
塞字节进去只会白烧 token，还要求模型支持视觉。（原实现的 `_to_data_url()` 在 URL 方案下
会把 `http://...` 误拼成 `data:image/jpeg;base64,http://...`，产生垃圾 —— 已删除。）

**③ 不要丢弃 assistant 历史。** 原来 `if msg["role"] != "user": continue` 会把历史 AI 回复
全丢掉，会话记忆直接失效。

## 四、前端契约（改 tool 返回结构时**必须同步**）

**这是最容易漏、后果最严重的一步。** 前端 `src/pages/Workspace.tsx` 的卡片会直接读
`metadata` 的嵌套字段，例如老代码里的 `res.metadata.brightness`。
如果 tool 换了返回结构而前端没跟上，`res.metadata` 变成 `undefined` →
**`Cannot read properties of undefined` 抛在 render 阶段 → 整个 React 树崩掉 → 整页白屏**。
项目里**没有 ErrorBoundary**，所以一崩就是全白，不是"卡片渲染不出来"那么局部。

排查这类问题的第一反应应该是：**接口有数据但页面空白 ⇒ 先看卡片是不是读了不存在的字段**。

**注意有两条独立的路径，两处都要改**（只改一处 → "刚发完能渲染、刷新后变纯文本"）：

| 路径 | 位置 | 要做的事 |
|------|------|----------|
| 实时对话 | `Workspace.tsx` 收到 `/api/chat` 响应后 | `buildResultFields(type, metadata)` |
| 恢复历史 | `hooks/useSession.ts` 的 `switchSession()` | 同样要调 `buildResultFields`，**这里最容易漏** |

所以 `buildResultFields` 应放在 `src/utils/workspace.ts` 供两处共用。

改动清单（缺一不可）：

1. `src/types/index.ts` 的类型定义
2. `src/pages/Workspace.tsx` 的卡片渲染分支
3. `src/pages/Workspace.tsx` 里所有引用该结果的地方（`setCorrectedImage`、`ResultActions`、
   其他卡片复用它的地方）
4. `src/hooks/useSession.ts` 的 `switchSession`（**最容易漏**）
5. `src/API.md` 的「消息类型说明」表
6. 删掉因改动而变成死代码的辅助组件（否则 lint 报 unused）

**验证技巧：`npx tsc --noEmit` 是最强的静态证据。** 因为类型定义换了之后，任何残留的
旧字段访问都会直接编译失败 —— tsc 通过就说明旧字段清干净了。再配一条
`grep -rn "\.metadata\." src/` 双保险。

**卡片里带交互状态（如"选中第几个候选"）时要抽成独立组件**，不能内联在
`MessageBubble` 的条件分支里 —— 条件分支里调 `useState` 违反 Hooks 规则。

**图片一律用 `src/components/SmartImage.tsx` 渲染**，不要直接写 `<img>`：
URL 会过期，它统一做「onError → 重试一次 → 仍失败显示已过期占位」，
并用 `min-h` 预留布局防止消息列表跳动。

**顺手加的兜底**：`MessageBubble` 最后不要 `return null`，改成「有文案就退化成文本气泡」。
否则 metadata 结构对不上的历史消息会渲染成完全空白，很难排查。

## 五、验证（两层，都要跑）

### 5.1 工具层：单独跑通，不经 LLM / Agent / Go

模板 `go-backend/agent/scripts/test_image_correction.py`。

难点：tool 入参是 URL，但测试图在本地磁盘。**解法：临时起静态 HTTP 服务把本地图变成 URL**，
测的就是生产同一条代码路径，不必给 tool 加「本地路径」分支。

```python
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
handler = partial(QuietHandler, directory=str(image_dir))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)   # 端口 0 = 随机
port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
```

### 5.2 全链路：前端 → Go → Agent → tool → 落库

模板 `go-backend/scripts/test_chat_chain.py`。**先在 `go-backend` 目录起后端**
（会自动拉起 Python Agent，起法见「六、命令」），另开终端跑脚本。脚本会：

1. 登录（`13800138000` / `test123`，失败则注册）
2. 建会话
3. 发 `POST /api/chat`，带**真实图片的 base64 dataURL** + `feature=correct`
4. 校验图片落盘 + URL 可达（注意图片是二进制，**不能 `json.loads`**）
5. 校验落库：`images` 是 URL 不是 base64；AI 回复的 `type`/`metadata` 正确

**会话详情响应是嵌套的**：`{"session": {"messages": [...]}}`，别读顶层 `messages`。

### 5.3 验证清单
- [ ] 正常路径 → `success=true`，字段齐全
- [ ] 不可达 URL → `IMAGE_NOT_FOUND`
- [ ] 404 → `IMAGE_NOT_FOUND`
- [ ] 非图片内容（.txt）→ `INVALID_IMAGE`（接口原话「无法解码图片」）
- [ ] `ToolNode` 序列化 → `ToolMessage.name` 正确、`content` 是合法 JSON
- [ ] `feature=correct` 短路路径
- [ ] `feature=null` 自由输入（LLM 语义路由）
- [ ] **未上线的 feature（如 `pick`）→ `type=text` + `metadata=null`**，不得返回编造数据；
      自由输入「帮我取色」也必须如实拒绝、**不得改用 `image_correction` 冒充**
- [ ] 多轮历史（问「我叫什么名字」能答出前文）
- [ ] 全链路脚本 5.2

### 5.4 浏览器端验证（改前端后必做）

用 `agent-browser`（本机已装，Chromium 在 `~/.agent-browser/browsers`）。
需要前端 dev server 在 5173 跑着。

**三条坑，不注意会白折腾。注意它们的共同根因是同一个：状态只在「一次 bash 调用」内有效。**

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

3. **不带登录直接 `open /workspace`，页面外壳照常渲染（工具坞都在），但所有 `/api/*`
   都是 401**，前端只显示一句含糊的「**AI 服务暂时不可用**」—— 很容易误判成后端挂了。
   **判据：看 Go 日志里是不是 401**（而不是 500/超时）。
   注意：**在同一次 bash 调用内**，localStorage 是**保留**的（`open login` → `eval` 写入 token
   → `open workspace` 能正常带鉴权，已实测），所以不用每次调用都重新登录 ——
   但一旦跨了 bash 调用就全没了。**登录步骤必须和后续操作同一次调用。**

**登录本项目的固定套路**（`testuser` / `13800138000` / `test123`）。

两种方式，**优先用第 2 种**（不用点表单，不受按钮 ref / 自动填充干扰）：

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

**上传图片走快捷工具**（`input[type=file]` 有两个，第一个是主图）：

```bash
agent-browser upload "input[type=file]" "<绝对路径>/testimage.jpg"
agent-browser click "textarea" && agent-browser press Enter
```

**消息列表是内部滚动容器，`screenshot --full` 抓不到下面**，要手动滚：

```bash
agent-browser eval "const el=[...document.querySelectorAll('*')].find(n=>n.scrollHeight>n.clientHeight+200&&n.clientHeight>200); el.scrollTop=el.scrollHeight; 'ok'"
```

⚠️ 更常见的翻车点：**目标元素所在的行比视口还高**（比如用户消息 = 320px 高的图 + 文字气泡）。
此时对**整行** `scrollIntoView({block:'center'})`，文字气泡仍会被挤到折叠线以下，
截出来的图和「什么都没改」时一模一样。
**要把目标元素本身滚进视野**：`bubble.scrollIntoView({block:'center'})`。
判据：`md5sum` 两张对比图 —— 若字节数几乎相同/哈希相同，说明**根本没截到变化区域**，别急着下结论。

**断言用 `eval` 比看截图可靠**（截图只能肉眼看，eval 能直接拿字符串）：

```bash
agent-browser eval "JSON.stringify({标题:[...document.querySelectorAll('h4')].map(h=>h.textContent), 图:[...document.querySelectorAll('img')].map(i=>i.src).filter(s=>s.includes('corr'))})"
```

#### 5.4.1 改 CSS / 布局时：用 **A/B 原地注入**证明「是这个改动起的作用」

只量「改完之后对不对」是不够的 —— 数字对也可能是别的原因凑巧。
**正确的做法是同一个 DOM 节点上量两次**：先量修复后的几何，再把那条 CSS 属性**内联改回旧值**
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

`screenshot` 支持 `screenshot [selector] [path]` 显式给路径；路径写 `D:/tmp/...`，
**别写 `/tmp/...`** —— Git Bash 的 `/tmp` 不是 Windows 的 `C:\tmp`（同 §六 的坑）。

**别忘了查 console**：`agent-browser console`，React 渲染错误会在这里。
任务结束务必 `agent-browser close`。

### 5.5 把硬编码改成配置时：**必须跑一次负向验证**

正向测试在硬编码的情况下**照样通过**，所以只跑正向等于没验。正确做法是故意填一个错值：

```bash
# 负向：把 AGENT_URL 指向一个没人监听的端口
cd go-backend && AGENT_URL=http://localhost:9999 D:/tmp/colorai-backend.exe
# 期望：/api/chat 报连接失败，且**错误信息里出现你填的那个值**（9999）
```

错误信息里出现你填的值 = 配置真的被读取；出现的是旧默认值 = 还有硬编码残留。

同一原则适用于：URL 前缀（`PUBLIC_BASE_URL`）、超时、阈值、模型名。
凡是「从写死改成可配」，都配一个负向用例。

## 六、命令

```bash
# 编译检查
cd go-backend && go build ./... && go vet ./...
cd go-backend && gofmt -l .          # 删代码块后结构体字面量对齐会变，必须跑
cd go-backend/agent && .venv/Scripts/python.exe -m py_compile app/tools/color_tools.py app/core/agent.py
cd ColorAI && npx tsc --noEmit && npm run lint
```

### 起后端：**编译成真二进制再跑**，不要用 `go run .`

```bash
cd go-backend && go build -o D:/tmp/colorai-backend.exe . && D:/tmp/colorai-backend.exe
```

必须在 `go-backend/` 目录下启动（`manager.go` 用 `os.Getwd()+"agent"` 找 Python 目录）。

**坑 1：`go run .` 被杀掉时，它编译出的子进程不会跟着死。** 于是端口 3001 仍被占用，
下一次 `go run .` 会报 `bind: Only one usage of each socket address` 然后退出 ——
但你以为是"新起的服务"，其实打的是旧进程（**会误判成"改动没生效"**）。
编译成真二进制再跑，你自己持有 PID，就能干净地杀掉。
排查前先确认占用者：`netstat -ano | grep :3001`。

**坑 2：Git Bash 的 `/tmp` 和 Go 的 `/tmp` 不是同一个目录。**
`go build -o /tmp/x.exe` 时 Go 把 `/tmp/x.exe` 当**当前盘根目录**解析 → 实际写到 `D:\tmp\x.exe`，
而 Git Bash 的 `/tmp` 在别处，于是 `ls /tmp/x.exe` 报"No such file"。
用显式盘符路径（`D:/tmp/...`）或相对路径，别用裸 `/tmp`。

**坑 3：`taskkill //PID <pid> //F` 在本机报 `无效参数/选项 - '//PID'`。**
改用 PowerShell：`Stop-Process -Id <pid> -Force`。

**坑 4：同时向同一个文件发多个 Edit 会竞争写、静默丢改动。**
（本机实测：3 个并行 Edit 到 `config.go`，其中 1 个被覆盖掉，工具仍报 success。）
改同一个文件必须**串行**，改完 Read 复核一遍。

Windows 控制台是 GBK，脚本开头要 `sys.stdout.reconfigure(encoding="utf-8")`，
否则中文输出报 `UnicodeEncodeError`。含反斜杠路径的 docstring 用 `r"""` 前缀。

## 七、收尾

- 测试产物放 `go-backend/tool-test-output/`（已在 `.gitignore`），别丢进 `doc/`
- 新增配置项同步写进两份 `.env.example`（Go 的和 agent 的）
- 设计文档「落地步骤」把完成的步骤打 ✅，并补实测结果
