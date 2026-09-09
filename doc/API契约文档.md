# API 契约文档

本文档梳理当前 Express 后端的所有接口定义,作为 Go 后端 1:1 替换的参考依据。

所有接口以 `/api` 为前缀。通用响应格式:

```json
{
  "success": true,
  ...
}
```

错误响应:

```json
{
  "success": false,
  "error": "错误描述"
}
```

---

## 1. 健康检查

```
GET /api/health
```

**响应:**

```json
{
  "success": true,
  "message": "ok"
}
```

---

## 2. 图片处理接口

### 2.1 图片一键校正

```
POST /api/color/correct
Content-Type: multipart/form-data
```

**请求参数:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | File | 是 | 原始图片(jpg/png/webp) |
| `mode` | string | 否 | 校正模式(auto/nature/portrait/product),当前后端未使用 |

**响应:**

```json
{
  "success": true,
  "originalUrl": "/uploads/1725000000-image-1234.jpg",
  "correctedUrl": "/uploads/1725000000-image-5678.jpg",
  "meta": {
    "brightness": 8,
    "contrast": 15,
    "saturation": 3,
    "temperature": -5
  }
}
```

**说明:** 当前后端为 mock 实现,`correctedUrl` 与 `originalUrl` 相同,`meta` 为随机值。

---

### 2.2 智能取色

```
POST /api/color/pick
Content-Type: application/json
```

**请求体:**

```json
{
  "imageUrl": "/uploads/xxx.jpg",
  "x": 50.5,
  "y": 30.2
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageUrl` | string | 是 | 图片 URL |
| `x` | number | 是 | 点击 x 坐标(百分比 0-100) |
| `y` | number | 是 | 点击 y 坐标(百分比 0-100) |

**响应:**

```json
{
  "success": true,
  "hex": "#FF6B35",
  "rgb": { "r": 255, "g": 107, "b": 53 },
  "name": "自定义色",
  "category": "暖色系"
}
```

**说明:** 当前后端为 mock 实现,返回随机 RGB 值。

---

### 2.3 颜色相似度对比

```
POST /api/color/compare
Content-Type: multipart/form-data
```

**请求参数:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageA` | File | 是 | 实物图 A |
| `imageB` | File | 是 | 实物图 B |

**响应:**

```json
{
  "success": true,
  "similarity": 87.5,
  "deltaE": 2.34,
  "pass": true,
  "images": {
    "imageA": "/uploads/xxx-imageA-1234.jpg",
    "imageB": "/uploads/xxx-imageB-5678.jpg"
  },
  "details": {
    "brightnessDiff": 1.2,
    "colorDiff": 3.4,
    "saturationDiff": -2.1
  }
}
```

**说明:** 当前后端为 mock 实现,`similarity` 在 60-98 之间随机,`deltaE` 在 0.3-8 之间随机。

---

### 2.4 手机拍摄校色

```
POST /api/color/phone-correct
Content-Type: multipart/form-data
```

**请求参数:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | File | 是 | 手机拍摄的原始图片 |

**响应:**

```json
{
  "success": true,
  "originalUrl": "/uploads/xxx-image-1234.jpg",
  "visualCorrectedUrl": "/uploads/xxx-image-1234.jpg",
  "standardCorrectedUrl": "/uploads/xxx-image-1234.jpg",
  "adjustment": {
    "redChannel": 5,
    "greenChannel": -3,
    "blueChannel": 8,
    "brightness": 12,
    "exposureCompensation": 0.6
  }
}
```

**说明:** 当前后端为 mock 实现,返回同一图片 URL,adjustment 为随机值。

---

## 3. 知识数据接口

### 3.1 偏色问题问答

```
GET /api/knowledge/color-issues?keyword=发红
```

**请求参数(Query):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 否 | 搜索关键词,模糊匹配 question/answer/category/tags |

**响应:**

```json
{
  "success": true,
  "items": [
    {
      "id": "ci-1",
      "question": "手机拍照校色后为什么会发红？",
      "answer": "手机拍照后偏红通常有以下几个原因...",
      "category": "发红",
      "tags": ["白平衡", "红色通道", "ISP算法"]
    }
  ],
  "total": 3
}
```

**QAItem 数据结构:**

```typescript
interface QAItem {
  id: string;
  question: string;
  answer: string;
  category?: string;  // 发红/发黄/发蓝/发暗/发白/其他
  tags?: string[];
  level?: number;     // photoTips 专用: 1=入门, 2=进阶, 3=专业
}
```

---

### 3.2 拍照技巧

```
GET /api/knowledge/photo-tips
```

**响应:** 同上,`items` 为 QAItem 数组(含 level 字段)。

---

### 3.3 附近商铺

```
GET /api/knowledge/shops?city=深圳
```

**请求参数(Query):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `city` | string | 否 | 城市名(深圳/上海/广州/北京/杭州),不传或 `all` 返回全部 |

**响应:**

```json
{
  "success": true,
  "items": [
    {
      "id": "s-1",
      "name": "深圳市彩虹色胶商行",
      "address": "深圳市龙岗区平湖街道华南城5号...",
      "city": "深圳",
      "phone": "0755-28881234",
      "products": ["工业颜色胶", "硅酮密封胶", "玻璃胶"],
      "rating": 4.8
    }
  ],
  "total": 5
}
```

**Shop 数据结构:**

```typescript
interface Shop {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  products: string[];
  rating: number;
}
```

---

### 3.4 品牌大全

```
GET /api/knowledge/brands?category=玻璃胶
```

**请求参数(Query):**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 品牌类别,不传或 `all` 返回全部,使用 `category` 数组的 `includes` 匹配 |

**响应:**

```json
{
  "success": true,
  "items": [
    {
      "id": "b-1",
      "name": "道康宁 DowCorning",
      "initial": "D",
      "rating": 4.9,
      "category": ["工业颜色胶", "硅酮密封胶", "玻璃胶", "结构胶"],
      "description": "全球硅基技术领导者...",
      "website": "https://www.dow.com"
    }
  ],
  "total": 3
}
```

**Brand 数据结构:**

```typescript
interface Brand {
  id: string;
  name: string;
  initial: string;
  rating: number;
  category: string[];
  description: string;
  website: string;
}
```

---

## 4. DeepSeek AI 对话代理

```
POST /api/deepseek/chat
Content-Type: application/json
```

**请求体:**

```json
{
  "messages": [
    { "role": "system", "content": "你是曲泉AI，一个专业的色彩智能体..." },
    { "role": "user", "content": "照片偏黄怎么校正？" }
  ],
  "model": "deepseek-chat"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messages` | Array | 是 | 对话消息数组,不能为空 |
| `messages[].role` | string | 是 | `system` / `user` / `assistant` |
| `messages[].content` | string | 是 | 消息内容 |
| `model` | string | 否 | 模型名,默认 `deepseek-chat` |

**成功响应:**

```json
{
  "success": true,
  "choices": [
    {
      "message": {
        "content": "照片偏黄通常是白平衡设置不准确导致的..."
      }
    }
  ],
  "model": "deepseek-chat",
  "usage": {
    "promptTokens": 156,
    "completionTokens": 89,
    "totalTokens": 245
  }
}
```

**错误响应:**

```json
// 400 - 缺少 messages
{ "success": false, "error": "Invalid request: messages array is required" }

// 500 - 未配置 API Key
{ "success": false, "error": "Server configuration error: DEEPSEEK_API_KEY not set" }

// 502 - DeepSeek API 返回异常
{ "success": false, "error": "Invalid response from DeepSeek API" }

// 503 - 无法连接 DeepSeek API
{ "success": false, "error": "Failed to reach DeepSeek API: ..." }
```

---

## 5. 用户认证接口(桩函数)

以下接口当前为 TODO 状态,Go 后端保留空路由返回占位响应即可。

```
POST /api/auth/register   → 501 Not Implemented
POST /api/auth/login      → 501 Not Implemented
POST /api/auth/logout     → 501 Not Implemented
```

---

## 6. 文件上传说明

- 上传目录: `ColorAI/public/uploads/` (Express) / `../go-backend/uploads/` (Go)
- 文件命名: `{时间戳}-{字段名}-{随机数}.{扩展名}`
- 通过 `/uploads/xxx.jpg` 路径可直接访问(Express 通过 `express.static` 提供)
- Go 后端需注册静态文件路由以提供相同访问方式

---

## 7. 前端调用注意事项

### 前端 API Client 配置

```typescript
// src/services/api.ts
const apiClient = axios.create({
  baseURL: isBrowser ? '/api' : 'http://localhost:3001/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
```

### Vite 代理配置

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',  // 后端地址,Go 后端也使用此端口
      changeOrigin: true,
    }
  }
}
```

### 图像处理的前端降级策略

前端 `src/services/colorService.ts` 已在浏览器端通过 Canvas 实现了完整的图像处理,不依赖后端。Go 后端的 `/api/color/*` 接口当前为 mock,后续可用 Go + OpenCV 实现真正的服务端图像处理。
