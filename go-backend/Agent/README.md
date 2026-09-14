# ColorAI Agent

基于 LangGraph 的色彩处理智能体服务，提供 AI 对话和工具调用能力。

## 功能特性

- **智能对话**：支持自然语言与用户交互
- **工具调用**：内置多种色彩处理工具
- **统一接口**：与 Go 后端接口格式兼容
- **可扩展**：易于添加新的工具和功能

## 内置工具

| 工具名称 | 功能说明 |
|----------|----------|
| image_correction | 图片一键校色 |
| color_extraction | 智能取色 |
| color_comparison | 颜色对比 |
| color_conversion | 颜色格式转换 |
| phone_correction | 手机拍摄校色 |

## 快速开始

### 1. 安装依赖

```bash
cd go-backend/Agent
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入 DEEPSEEK_API_KEY
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
cd go-backend/Agent

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
      "content": "这张图片偏色了",
      "images": ["data:image/jpeg;base64,..."]
    }
  ]
}
```

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
      "originalImage": "...",
      "correctedImage": "...",
      "metadata": {...}
    },
    "createdAt": 1694678400000
  }
}
```

### 健康检查

```
GET /health
```

## 项目结构

```
Agent/
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

Python Agent 服务运行在 8000 端口，Go 后端可以通过 HTTP 调用：

```go
// 在 Go 后端中调用 Python Agent
resp, err := http.Post("http://localhost:8000/api/chat", "application/json", requestBody)
```

## 开发说明

### 添加新工具

1. 在 `app/tools/color_tools.py` 中使用 `@tool` 装饰器定义新工具
2. 在 `get_all_tools()` 函数中注册新工具
3. 更新 `app/core/agent.py` 中的系统提示词

### 修改智能体逻辑

编辑 `app/core/agent.py` 中的 `ColorAgent` 类。

## 许可证

MIT License
