# ColorAI Agent

基于 LangGraph 的色彩处理智能体服务，提供 AI 对话和工具调用能力。

## 功能特性

- **智能对话**：支持自然语言与用户交互
- **工具调用**：当前仅内置「图片一键校色」一个工具
- **统一接口**：与 Go 后端接口格式兼容
- **可扩展**：易于添加新的工具和功能

## 内置工具

**只注册已实现的工具。** `get_all_tools()` 返回的就是下面这一份清单，
`SYSTEM_PROMPT` 也只宣传这里列出的能力。

| 工具名称 | 功能说明 | 状态 |
|----------|----------|------|
| `image_correction` | 图片一键校色（对接搭档校色接口） | ✅ 已实现 |

以下 4 个能力**尚未实现，故意不注册**：`color_extraction`（智能取色）、
`color_comparison`（颜色对比）、`color_conversion`（颜色格式转换）、
`phone_correction`（手机拍摄校色）。前端工具坞同步置灰并打「开发中」角标。

> ⚠️ 它们曾经以 stub 形式注册过，返回写死的假数据（`#FF5733` 之类），
> LLM 会把编造的色值包装成「主色调为橙红，属于暖色系」这种专业结论 ——
> **用户无法分辨真假**。这是本项目踩过的最严重的一类坑，详见
> `go-backend/doc/图片校色Tool封装设计.md` §8.2。

## 快速开始

### 1. 安装依赖

```bash
cd go-backend/agent
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env：
#   DEEPSEEK_API_KEY  —— 必填
#   CORRECTION_API_URL —— 校色服务地址，.env.example 已预填，一般不用改
#   DEEPSEEK_THINKING —— 保持 false。带 tools 请求时思考模式会要求回传 reasoning_content，
#                        而 langchain-openai 0.2.1 不处理该字段，必然 400
```

### 3. 启动服务

```bash
python -m app.main
```

服务将在 http://localhost:8000 启动

### 4. 访问 API 文档

打开浏览器访问 http://localhost:8000/docs 查看交互式 API 文档

## Docker 部署

### 使用 docker-compose

```bash
cd go-backend/agent

# 设置环境变量
export DEEPSEEK_API_KEY=your_api_key_here

# 启动服务
docker-compose up -d
```

### 手动构建

```bash
docker build -t colorai-agent .
docker run -p 8000:8000 -e DEEPSEEK_API_KEY=your_key colorai-agent
```

## API 接口

### 聊天接口

```
POST /api/chat
```

**请求示例：**

```json
{
  "sessionId": "session-uuid",
  "messageId": "msg-xxx",
  "messages": [
    {
      "role": "user",
      "content": "帮我进行图片校色",
      "feature": "correct",
      "images": ["http://localhost:3001/uploads/chat/2026/09/17/xxxx.jpg"]
    }
  ]
}
```

两点约定：

- **`images` 里是 URL，不是 base64。** Go 侧收到前端 dataURL 后先解码落盘、拼出完整 URL
  （前缀来自 `PUBLIC_BASE_URL`），**只把 URL 传给 Agent**。几 MB 的 base64 既进不了
  LLM 的 tool 参数（tool 参数由 LLM 生成 token），也会让请求体膨胀。
- **`feature` 挂在消息上**（不是 `ChatRequest` 顶层），且是**工具选择的最高优先级信号**：
  非空时代码直接调用映射的工具、不让 LLM 选（映射表见 `agent.py` 的 `FEATURE_TOOL_MAPPING`）；
  为 `null` 时才走语义分析。

**响应示例：**

```json
{
  "success": true,
  "message": {
    "id": "msg_xxx",
    "role": "assistant",
    "type": "correct",
    "content": "已为您完成图片校色",
    "metadata": {
      "success": true,
      "passed": true,
      "originalImage": "http://localhost:3001/uploads/chat/2026/09/17/original.jpg",
      "candidates": [
        {
          "correctedImage": "http://localhost:3001/uploads/chat/2026/09/17/corrected.jpg",
          "distance": 12.3,
          "modelName": "iPhone 15 Pro"
        }
      ],
      "distance": 12.3,
      "threshold": 20,
      "brand": "Apple",
      "elapsedTime": 3.1
    },
    "createdAt": 1694678400000
  }
}
```

`metadata` 的结构由 `message.type` 决定，**契约以前端 `ColorAI/src/types/index.ts` 为准**
（`CorrectionResult` / `CompareResult` / `PhoneCorrectResponse` / `FullColorValues`），
工具返回值必须逐字段对齐。注意 `color` 这类字段要给结构化分量对象，
不能是 `"rgb(1, 2, 3)"` 这种预格式化字符串 —— 格式化是前端的事。

`type=text`（含未上线能力的如实说明）时 `metadata` 为 `null`，前端按纯文本渲染。

### 健康检查

```
GET /health
```

## 项目结构

```
agent/
├── app/
│   ├── api/            # API路由
│   │   ├── chat.py     # 聊天接口
│   │   └── health.py   # 健康检查
│   ├── core/           # 核心模块
│   │   └── agent.py    # LangGraph智能体
│   ├── tools/          # 工具定义
│   │   └── color_tools.py
│   ├── models/         # 数据模型
│   │   └── schemas.py
│   ├── utils/          # 工具函数
│   ├── config.py       # 配置管理
│   └── main.py         # 主应用
├── requirements.txt    # Python依赖
├── Dockerfile          # Docker配置
├── docker-compose.yml  # Docker Compose配置
└── .env.example        # 环境变量示例
```

## 与 Go 后端集成

Go 后端通过 HTTP 调用本服务，地址来自 `config.AgentURL`（`go-backend/.env` 的 `AGENT_URL`，
默认 `http://localhost:8000`）—— **不要硬编码**。它同时驱动两处：
`service/chat_service.go` 的 `/api/chat` 转发，和 `agent/manager.go` 的 `/health` 探活。

```go
// 地址来自 config.AgentURL
resp, err := http.Post(cfg.AgentURL+"/api/chat", "application/json", requestBody)
```

⚠️ `AGENT_URL` 必须与 `agent/.env` 的 `AGENT_PORT` 保持一致 ——
Python 侧监听的端口来自 `settings.AGENT_PORT`（**不是** `PORT`，那个是 Go 的，
当初就是为了避免两者混淆才这么命名）。

Go 后端启动时会**自动拉起**本服务（`agent/manager.go`），所以本地开发一般不用单独启动；
要单独跑见上面的「启动服务」。注意 Go 是按**当前工作目录**去找 `agent/` 的，
所以必须在 `go-backend/` 目录下启动它。

## 开发说明

### 添加新工具

1. 在 `app/tools/color_tools.py` 中用 `@tool` 装饰器定义工具
2. 在 `get_all_tools()` 中注册
3. 更新 `app/core/agent.py` 的 `SYSTEM_PROMPT`，把该能力从「未上线」挪到「已上线」
4. 补 `agent.py` 的 `FEATURE_TOOL_MAPPING`（feature → 工具名 + 图片参数名），
   前端快捷工具才能走确定性短路
5. 前端把 `ColorAI/src/constants/workspace.ts` 里对应项的 `available` 改成 `true`

**三条硬规则：**

- **未实现的工具绝不能注册**，也不要写进 `SYSTEM_PROMPT`。注册了 LLM 就会调用它，
  然后拿假数据编出专业结论 —— 用户分辨不出来。
- **两条路径都要通才算接入**：`feature` 非空时走短路（用不带 tools 的 `self.llm` 生成总结，
  避免重复调用），为空时走 LLM 语义分析。
- **改返回结构必须同步前端契约**（`ColorAI/src/types/index.ts`），并检查
  `Workspace.tsx` 与 `hooks/useSession.ts` **两处**都走 `buildResultFields` ——
  只改一处会出现「刚发完能渲染、刷新后卡片变纯文本」。

完整流程与踩坑清单见 `go-backend/doc/图片校色Tool封装设计.md`。

### 修改智能体逻辑

编辑 `app/core/agent.py` 中的 `ColorAgent` 类。

## 许可证

MIT License
