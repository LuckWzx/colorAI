# ColorAI API 接口文档

> 基于前端服务层定义，后端实现应以此文档为准。

## 基础信息

| 项目 | 说明 |
|------|------|
| 基础路径 | `/api` |
| 请求格式 | `application/json` |
| 超时时间 | 30 秒 |
| 认证方式 | Bearer Token（Header: `Authorization`） |

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
    "id": "uuid",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  },
  "token": "jwt-token-string"
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
    "id": "uuid",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  },
  "token": "jwt-token-string"
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
  "sessionId": "session-uuid",
  "messages": [
    {
      "role": "system",
      "content": "你是曲泉AI，一个专业的色彩智能体..."
    },
    {
      "role": "user",
      "content": "这张图片的主色调是什么？"
    }
  ],
  "model": "deepseek-chat"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 否 | 会话ID，用于关联对话历史 |
| messages | ChatMessage[] | 是 | 消息数组，至少包含一条消息 |
| model | string | 否 | 模型标识，默认 deepseek-chat |

**ChatMessage 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| role | string | `user` / `assistant` / `system` |
| content | string | 消息内容 |

**成功响应：**

```json
{
  "success": true,
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "根据您上传的图片，主色调是..."
      }
    }
  ],
  "model": "deepseek-chat",
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
| choices | ChatChoice[] | 回复选项数组 |
| choices[].message.role | string | 固定为 `assistant` |
| choices[].message.content | string | AI 回复内容 |
| model | string | 使用的模型标识 |
| usage.promptTokens | number | 输入 token 数 |
| usage.completionTokens | number | 输出 token 数 |
| usage.totalTokens | number | 总 token 数 |

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
        "id": "msg-uuid",
        "role": "user",
        "content": "这张图片偏色了",
        "timestamp": 1694678400000,
        "type": "text"
      },
      {
        "id": "msg-uuid",
        "role": "assistant",
        "content": "我来帮您分析一下...",
        "timestamp": 1694678460000,
        "type": "text"
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
| messages | Message[] | UI 渲染用消息数组（含 id、type 等） |
| history | ChatMessage[] | LLM 对话历史（仅 role + content） |

---

### 7. 创建新会话

```
POST /api/sessions
```

**成功响应：**

```json
HTTP 201
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "title": "",
    "createdAt": 1694678400000,
    "updatedAt": 1694678400000,
    "messageCount": 0
  }
}
```

---

### 8. 保存会话

```
PUT /api/sessions/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 会话ID |

**请求体：**

```json
{
  "title": "色彩校正咨询",
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "这张图片偏色了",
      "timestamp": 1694678400000,
      "type": "text"
    }
  ],
  "history": [
    {
      "role": "user",
      "content": "这张图片偏色了"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 会话标题 |
| messages | Message[] | 否 | UI 渲染用消息数组 |
| history | ChatMessage[] | 否 | LLM 对话历史 |

**成功响应：**

```json
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "title": "色彩校正咨询",
    "createdAt": 1694678400000,
    "updatedAt": 1694679000000,
    "messageCount": 6
  }
}
```

---

### 9. 删除会话

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

### 10. 获取用户信息

```
GET /api/user/profile
```

**成功响应：**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "张三",
    "phone": "13800138000",
    "avatar": "",
    "createdAt": "2026-09-14T12:00:00Z"
  }
}
```

---

## 健康检查 `/api/health`

### 11. 服务健康检查

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

## 前端本地处理接口

以下功能在前端本地实现，不调用后端 API：

### 色彩处理（colorService）

| 功能 | 方法 | 说明 |
|------|------|------|
| 图片一键校正 | `correctImage(file, mode)` | Canvas 本地处理，支持 auto/portrait/landscape/product 模式 |
| 智能取色 | `extractDominantColors(dataUrl, count)` | 提取图片主色调，返回 HEX + 占比 |
| 颜色对比 | `compareImages(fileA, fileB)` | 计算 ΔE2000 色差值 |
| 颜色胶匹配 | `matchColorGel(hex)` | 基于 HEX 生成相近颜色胶 |
| 手机拍摄校色 | `phoneCorrectImage(file, device, scene)` | 还原手机拍摄的真实色彩 |

### 色彩空间转换（colorConverter）

支持格式：HEX、RGB、HSL、CMYK、Lab、HSV 互转

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
2. **Token 存储**：前端通过 Zustand 持久化至 `localStorage`（key: `colorai_auth`）
3. **请求携带**：Axios 拦截器自动在 Header 中注入 `Authorization: Bearer <token>`
4. **401 处理**：响应拦截器捕获 401，自动清除登录态并跳转至登录页
