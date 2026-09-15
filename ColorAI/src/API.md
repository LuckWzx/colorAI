# ColorAI API 接口文档

> 基于前端服务层定义，后端实现应以此文档为准。

## 基础信息

| 项目 | 说明 |
|------|------|
| 基础路径 | `/api` |
| 请求格式 | `application/json` |
| 超时时间 | 30 秒 |
| 认证方式 | Bearer Token（Header: `Authorization`） |

## 系统提示词（System Prompt）

系统提示词由后端管理，前端无需携带。后端会在调用 LLM API 时自动注入。

**系统提示词内容：**

```
你是曲泉AI，一个专业的色彩智能体。你的专长是：
1. AI 一键校色：帮助用户校正图片的白平衡、色彩还原
2. 智能取色：从图片中提取主色调，支持 HEX/RGB/HSL/CMYK/Lab 等格式
3. 色彩空间转换：在不同色彩空间之间精准转换
4. 颜色对比：量化两个颜色的相似度（ΔE）
5. 手机拍摄校色：还原手机照片的人眼视觉真实色彩

请用专业、简洁、友好的语气回答用户关于色彩的问题。
当用户询问色彩理论、校色技巧、设备选择、行业应用等问题时，给出准确、实用的建议。
回答时适当使用色彩相关的专业术语，但要解释清楚。
```

**说明：**
- 前端发送聊天请求时，`messages` 数组中不需要包含 `system` 角色的消息
- 后端会自动在 `messages` 数组开头插入系统提示词
- 如需修改系统提示词，请更新后端配置或代码中的 `COLOR_SYSTEM_PROMPT` 常量

## ID 格式说明

| 实体 | 格式 | 示例 |
|------|------|------|
| 用户 ID | `u_{UnixNano}` | `u_1694678400000000000` |
| 会话 ID | `session-{16位hex}` | `session-0a1b2c3d4e5f6789` |
| 消息 ID | `msg-{16位hex}` | `msg-0a1b2c3d4e5f6789` |

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  ...data
}
```

### 失败响应

```json
{
  "success": false,
  "error": "错误信息"
}
```

### 认证失败

```json
HTTP 401
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## 认证模块 `/api/auth`

### 1. 用户注册

```
POST /api/auth/register
```

**请求体：**

```json
{
  "username": "张三",
  "phone": "13800138000",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| username | string | 是 | 2-20 字符 |
| phone | string | 是 | 11 位手机号 |
| password | string | 是 | 6-32 位密码 |

**成功响应：**

```json
{
  "success": true,
  "user": {
    "id": "u_1694678400000000000",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  },
  "token": "tk_u_1694678400000000000_a1b2c3d4e5f6"
}
```

---

### 2. 用户登录

```
POST /api/auth/login
```

**请求体：**

```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| phone | string | 是 | 11 位手机号 |
| password | string | 是 | 6 位以上密码 |

**成功响应：**

```json
{
  "success": true,
  "user": {
    "id": "u_1694678400000000000",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  },
  "token": "tk_u_1694678400000000000_a1b2c3d4e5f6"
}
```

---

### 3. 用户登出

```
POST /api/auth/logout
```

**请求头：**

```
Authorization: Bearer <token>
```

**成功响应：**

```json
{
  "success": true
}
```

---

## AI 对话 `/api/chat`

> **所有前端操作（聊天、图片校色、取色、颜色对比等）统一通过此接口调用**

### 工作流程

```
用户输入 → /api/chat → 后端智能体 → 语义分析 → 选择Tool → 执行 → 统一响应
```

**说明：**
- 前端所有操作都通过 `/api/chat` 接口发送
- 后端智能体根据用户输入的语义，自动判断需要调用哪个 Tool
- Tool 执行结果封装在统一的 `message` 格式中返回
- 前端无需关心具体调用了哪个 Tool，只需根据 `message.type` 渲染不同 UI

### Tool 工具列表

| Tool 名称 | 触发场景 | 返回 message.type |
|-----------|----------|-------------------|
| image_correction | 用户上传图片，要求校色 | `correct` |
| color_extraction | 用户上传图片，要求取色 | `pick` |
| color_comparison | 用户上传两张图片，要求对比 | `compare` |
| color_conversion | 用户输入颜色值，要求转换格式 | `convert` |
| phone_correction | 用户上传手机照片，要求校色 | `phone` |
| text_chat | 其他对话场景 | `text` |

### 前端交互流程

#### 1. 快捷工具调用（语义预定义）

```
用户点击快捷工具按钮 → 禁用输入框 → 自动发送预定义消息 → /api/chat → 后端执行Tool → 返回结果
```

**示例：**
- 用户点击"一键校色" → 自动发送 `{ feature: 'correct', text: '请校色' }` → 后端调用 `image_correction` Tool
- 用户点击"智能取色" → 自动发送 `{ feature: 'pick', text: '请取色' }` → 后端调用 `color_extraction` Tool

**前端行为：**
- 点击快捷工具按钮后，**禁用/隐藏输入框**
- 用户无需输入文字，系统自动发送预定义指令
- 工具执行完成后，恢复输入框

#### 2. 自由对话（用户输入语义）

```
用户在输入框输入 → 启用输入框 → 发送用户消息 → /api/chat → 后端智能体分析 → 选择Tool或文本回复
```

**前端行为：**
- 输入框始终可用
- 用户输入自然语言描述需求
- 智能体根据语义自动判断调用哪个Tool

---

### 4. 发送对话消息

```
POST /api/chat
```

**请求头：**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体：**

```json
{
  "sessionId": "session-0a1b2c3d4e5f6789",
  "messageId": "msg-0a1b2c3d4e5f6789",
  "messages": [
    { "role": "user", "content": "这张图片偏色了", "images": ["data:image/jpeg;base64,..."] },
    { "role": "assistant", "content": "我来帮您分析一下这张图片的白平衡…" },
    { "role": "user", "content": "请取色", "feature": "pick", "images": ["data:image/jpeg;base64,..."] }
  ],
  "model": "deepseek-chat"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 否 | 会话ID，用于关联对话历史 |
| messageId | string | 否 | 消息ID（前端生成，用于SSE/WebSocket场景关联） |
| messages | ChatMessage[] | 是 | **完整对话历史**（按时间正序的 `user` / `assistant` 轮次），最后一条必须是当前用户消息。详见下文「messages 语义」 |
| model | string | 否 | 模型标识，默认 deepseek-chat |

**ChatMessage 结构：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| role | string | 是 | `user` / `assistant`（`system` 角色由后端自动注入） |
| content | string | 是 | 消息文本内容 |
| feature | string \| null | 否 | 快捷工具标识：`correct` / `pick` / `compare` / `convert` / `phone`；自由对话时为 `null`。**只挂在当前用户消息（最后一条）上**，详见下文「feature 与工具选择」 |
| images | string[] \| null | 否 | 图片数据数组（base64 / dataURL），**只挂在当前用户消息（最后一条）上** |

### messages 语义：完整对话历史

`messages` 是**完整对话历史**，不是仅当前这一条：

- 按时间正序排列，包含本轮之前所有 `user` / `assistant` 轮次，**最后一条是当前用户消息**。
- 用途：会话记忆。后端需把完整历史转发给 Agent，供 LLM 建立多轮上下文。
- 前端**每次发送完整历史**；后端**只需持久化最后一条用户消息 + AI 回复**，不要重复落库历史轮次（否则会重复计数）。
- `feature` / `images` 只挂在当前用户消息上，历史轮次不携带。

### feature 字段与工具选择

`feature` 是**工具选择的最高优先级信号**，由前端在用户点击快捷工具按钮时设置：

| feature | 必须调用的 Tool | 返回 message.type |
|---------|-----------------|-------------------|
| `correct` | `image_correction` | `correct` |
| `pick` | `color_extraction` | `pick` |
| `compare` | `color_comparison` | `compare` |
| `convert` | `color_conversion` | `convert` |
| `phone` | `phone_correction` | `phone` |
| `null` | 由 Agent 语义分析决定（可能调用某个 Tool，也可能纯文本回复） | 依实际调用 |

**选择规则（后端与 Agent 必须遵守）：**

1. `feature` 非 `null`（用户点击快捷工具按钮）→ 后端**原样透传**给 Agent，Agent **确定性地调用**映射的 Tool，**不做语义判断**，避免 LLM 选错工具。
2. `feature` 为 `null`（用户在输入框自由输入）→ Agent 通过语义分析自行判断是否调用 Tool、调用哪一个；无法判断时走纯文本回复（`message.type = "text"`）。

**请求场景示例：**

| 场景 | content | feature | images |
|------|---------|---------|--------|
| 自由对话 | "色彩理论是什么？" | `null` | `null` |
| 快捷校色 | "请校色" | `"correct"` | `["data:image/jpeg;base64,..."]` |
| 快捷取色 | "请取色" | `"pick"` | `["data:image/jpeg;base64,..."]` |
| 快捷对比 | "请对比" | `"compare"` | `["data:...", "data:..."]` |
| 自然语言校色 | "这张图片偏色了" | `null` | `["data:image/jpeg;base64,..."]` |

**成功响应：**

```json
{
  "success": true,
  "message": {
    "id": "msg-0a1b2c3d4e5f6789",
    "role": "assistant",
    "type": "text",
    "content": "根据您上传的图片，主色调是...",
    "metadata": null,
    "createdAt": 1694678400000
  },
  "usage": {
    "promptTokens": 1234,
    "completionTokens": 567,
    "totalTokens": 1801
  }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| message | Message | 统一消息对象 |
| message.id | string | 消息唯一标识 |
| message.role | string | 固定为 `assistant` |
| message.type | string | 消息类型：`text` / `correct` / `pick` / `compare` / `convert` / `phone` |
| message.content | string | 消息文本内容（AI 回复或工具结果描述） |
| message.metadata | object \| null | 工具结果数据（仅工具类型消息包含） |
| message.createdAt | number | 消息创建时间（epoch 毫秒） |
| usage | object \| null | Token 用量统计（AI 对话时返回） |
| usage.promptTokens | number | 输入 token 数 |
| usage.completionTokens | number | 输出 token 数 |
| usage.totalTokens | number | 总 token 数 |

**消息类型说明：**

| type | 说明 | metadata 结构 |
|------|------|---------------|
| `text` | 智能体文本回复 | `null` |
| `correct` | 图片校色结果 | `{ originalImage: string, correctedImage: string, metadata: { brightness: number, contrast: number, saturation: number, whiteBalance: 'warm' \| 'cool' \| 'neutral' } }` |
| `pick` | 取色结果 | `{ color: FullColorValues, colorName: string }` |
| `compare` | 颜色对比结果 | `{ similarity: number, deltaE: number, imageA: { imageUrl: string, dominantColors: Array<{ hex: string, ratio: number }> }, imageB: { imageUrl: string, dominantColors: Array<{ hex: string, ratio: number }> } }` |
| `convert` | 颜色转换结果 | `{ input: string, detectedFormat: string, color: FullColorValues, colorName: string }` |
| `phone` | 手机拍摄校色结果 | `{ originalUrl: string, correctedUrl: string, standardUrl: string, adjustment: { redShift: number, greenShift: number, blueShift: number, brightness: number, exposure: number } }` |

> 以上结构即前端 `src/types/index.ts` 的类型定义（`CorrectionResult` / `CompareResult` / `PhoneCorrectResponse` 等），后端工具返回值必须与之逐字段对齐，否则结果卡片渲染为空白。

**FullColorValues 结构（`pick` / `convert` 的 `color` 字段）：**

```json
{
  "hex": "#FF6B35",
  "rgb": { "r": 255, "g": 107, "b": 53 },
  "hsl": { "h": 16, "s": 100, "l": 60 },
  "cmyk": { "c": 0, "m": 58, "y": 79, "k": 0 },
  "lab": { "l": 63.4, "a": 45.2, "b": 48.1 },
  "hsv": { "h": 16, "s": 79, "v": 100 },
  "format": "hex",
  "originalInput": "#FF6B35"
}
```

> `format` 取 `hex` / `rgb` / `hsl` / `cmyk` / `lab` / `hsv` / `unknown`。注意 `color` 必须是**结构化分量对象**，不能返回 `"rgb(255, 107, 53)"` 这类预格式化字符串——前端 `formatColorValue()` 需要读取 `color.rgb.r` 等分量自行格式化。

**消息持久化（会话记忆）：**

`/api/chat` 成功后，后端必须把本轮消息落库，供 `GET /api/sessions/:id` 还原：

| 落库字段 | 取值 |
|----------|------|
| 用户消息 `role` | `user`，`content` 取当前用户消息文本 |
| 用户消息 `payload` | `{ feature, images }`（无则 `null`），用于还原快捷工具与图片 |
| AI 回复 `role` | `assistant` |
| AI 回复 `msgType` | **必须等于响应的 `message.type`**（`text` / `correct` / `pick` / …），不可恒为 `text` |
| AI 回复 `payload` | **必须序列化响应的 `message.metadata`**，不可恒为 `null` |

> 若把 `msgType` 恒写为 `text`、`payload` 恒写为 `null`，则刷新或切换会话后所有结果卡片会退化成纯文本气泡。

---

## 会话管理 `/api/sessions`

> 以下接口均需要登录（Bearer Token）

### 5. 获取会话列表

```
GET /api/sessions
```

**成功响应：**

```json
{
  "success": true,
  "items": [
    {
      "id": "session-uuid",
      "title": "色彩校正咨询",
      "createdAt": 1694678400000,
      "updatedAt": 1694679000000,
      "messageCount": 12
    }
  ],
  "total": 1
}
```

**ChatSessionDTO 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 会话唯一标识 |
| title | string | 会话标题（根据首条消息推断） |
| createdAt | number | 创建时间（epoch 毫秒） |
| updatedAt | number | 更新时间（epoch 毫秒） |
| messageCount | number | 消息数量 |

---

### 6. 获取会话详情

```
GET /api/sessions/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 会话ID |

**成功响应：**

```json
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "title": "色彩校正咨询",
    "createdAt": 1694678400000,
    "updatedAt": 1694679000000,
    "messageCount": 12,
    "messages": [
      {
        "id": "msg-0a1b2c3d4e5f6789",
        "role": "user",
        "type": "text",
        "content": "这张图片偏色了",
        "createdAt": 1694678400000,
        "images": ["data:image/jpeg;base64,..."]
      },
      {
        "id": "msg-0a1b2c3d4e5f6790",
        "role": "assistant",
        "type": "text",
        "content": "我来帮您分析一下...",
        "createdAt": 1694678460000
      }
    ],
    "history": [
      {
        "role": "user",
        "content": "这张图片偏色了"
      },
      {
        "role": "assistant",
        "content": "我来帮您分析一下..."
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| messages | Message[] | UI 渲染用消息数组。字段：`id` / `role` / `type` / `content` / `createdAt`；用户消息额外含 `feature` / `images` |
| history | ChatMessage[] | LLM 对话历史（仅 `role` + `content`），用于恢复前端多轮上下文 |

> 注意：`messages[].type` 取 `text` / `correct` / `pick` / `compare` / `convert` / `phone`，与 `/api/chat` 响应的 `message.type` 同义；工具结果类消息的 `metadata` 需持久化后才能在此处还原卡片（见下文「消息持久化」）。

---

### 7. 创建新会话

```
POST /api/sessions
```

**请求体：**

```json
{
  "title": "色彩校正咨询"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | 会话标题，不传则默认为"新对话"，推荐传入用户首条消息前26字符作为标题 |

**成功响应：**

```json
HTTP 201
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "title": "色彩校正咨询",
    "createdAt": 1694678400000,
    "updatedAt": 1694678400000,
    "messageCount": 0
  }
}
```

**说明：**
- 创建时机：用户在新会话中发送第一条消息时触发
- 标题来源：取用户消息前26个字符作为会话标题

---

### 8. 删除会话

```
DELETE /api/sessions/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 会话ID |

**成功响应：**

```json
{
  "success": true
}
```

---

## 用户信息 `/api/user`

### 9. 获取用户信息

```
GET /api/user/profile
```

**成功响应：**

```json
{
  "success": true,
  "user": {
    "id": "u_1694678400000000000",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  }
}
```

---

## 健康检查 `/api/health`

### 10. 服务健康检查

```
GET /api/health
```

**成功响应：**

```json
{
  "success": true,
  "message": "ok"
}
```

---

## 后端工具接口（Tool）

以下功能封装为智能体工具（Tools），通过 AI 对话接口调用返回，不直接暴露给前端：

### 色彩处理工具

| 工具名称 | 说明 | 调用方式 |
|----------|------|----------|
| image_correction | 图片一键校正，支持 auto/portrait/landscape/product 模式 | 智能体根据用户意图自动调用 |
| color_extraction | 智能取色，提取图片主色调，返回 HEX + 占比 | 智能体根据用户意图自动调用 |
| color_comparison | 颜色对比，计算 ΔE2000 色差值，量化两图相似度 | 智能体根据用户意图自动调用 |
| color_conversion | 色彩空间转换，HEX / RGB / HSL / CMYK / Lab / HSV 互转 | 智能体根据用户意图自动调用 |
| phone_correction | 手机拍摄校色，还原手机拍摄的真实色彩 | 智能体根据用户意图自动调用 |

### 工具调用说明

- **调用流程**：用户通过聊天描述需求 → 智能体解析意图 → 自动选择合适工具 → 返回处理结果
- **参数传递**：图片以 base64（dataURL）放在 `/api/chat` 消息的 `images` 字段中提交，颜色参数通过消息文本传递
- **响应格式**：工具执行结果封装在 AI 回复的 `message.metadata` 字段中，消息 `type` 标识对应的结果卡片（见上文「消息类型说明」）

### 色彩空间转换（colorConverter）

支持格式：HEX、RGB、HSL、CMYK、Lab、HSV 互转（转换由后端智能体工具 `color_conversion` 完成；前端仅负责输入格式识别与结果展示格式化）

---

## 错误码说明

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或 Token 过期 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 502 | AI 服务返回异常 |
| 503 | AI 服务不可用 |

---

## 认证流程说明

1. **登录/注册**：调用 `/api/auth/login` 或 `/api/auth/register` 获取 `token`
2. **Token 存储**：前端通过 Zustand 持久化至 `localStorage`（key: `colorai_auth`，结构为 `{ state: { user, token, isAuthenticated } }`）
3. **请求携带**：前端有两条请求通道，均自动注入 `Authorization: Bearer <token>`
   - **认证接口**（`/api/auth/*`）：Axios 实例 `services/api.ts`，请求拦截器从 `localStorage` 读取 token
   - **业务接口**（`/api/chat`、`/api/sessions/*`）：`authFetch`（`lib/authFetch.ts`），直接从 Zustand store 读取 token
4. **401 处理**：**当前仅 Axios 通道有 401 拦截**（`services/api.ts`）——捕获 401 后清除登录态并跳转登录页。`authFetch` 通道（聊天、会话）**尚未实现 401 自动登出**，token 过期时前端仅提示错误。后端返回 401 时应保持语义一致（`{ success: false, error: "Unauthorized" }`），前端后续会补齐统一处理。
