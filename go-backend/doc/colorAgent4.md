# 版本演进说明

## V1.0 版本（已规划）

> **🎯 V1.0 实施范围**：
> - **只实现图片校色功能**（基于 Color_Correction.md 接口）
> - **长短期记忆功能暂不实现**
> - **其他功能（取色、比对、文生图等）后续迭代**

---

## V2.0 版本（当前设计）

> **🚀 V2.0 实施范围**：
> - **引入Python智能体（LangGraph）实现多步骤任务编排**
> - **实现完整的服务边界：Go后端 + Python智能体 + 远程视觉服务**
> - **支持复杂任务：校色 → 取色 → 语义分析 → 配色建议**
> - **长短期记忆功能（Checkpointer + Store）**

---

既然你已经确定 **Python + LangGraph**，我建议把前面的方案彻底切换到 **LangGraph 的 StateGraph + Nodes + Edges + ToolNode + Checkpointer** 这套思路。

LangGraph 本身定位就是偏底层的 Agent 编排运行时，核心就是 **State、Node、Edge**，适合你这种既有确定性视觉处理，又有 LLM 推理、Tool Calling、多步骤任务的场景。([LangChain AI][1])

下面我按照你这个**材料颜色“所见即所得”智能体**来给你一版可以真正落地的完整架构。

---

# 一、先确定最终架构

我建议 V1 不做“多个 Agent”，而是：

> **1 个 Color Agent + LangGraph 工作流 + 多个 Tool + Python Vision Service + 多模态模型**

整体：

```text
                         用户
                          │
             ┌────────────┴────────────┐
             │                         │
        快捷工具入口                 AI 对话
             │                         │
             └────────────┬────────────┘
                          ▼
               ┌─────────────────────┐
               │   Color Vision      │
               │       Agent         │
               │      LangGraph      │
               └──────────┬──────────┘
                          │
                   ┌──────▼──────┐
                   │ Intent Node │
                   └──────┬──────┘
                          │
                    ┌─────▼─────┐
                    │ Agent Node│
                    │ LLM推理    │
                    └─────┬─────┘
                          │
                     Tool Calling
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Vision        Semantic    Generation
           Tools          Tools        Tools
             │             │            │
             ▼             ▼            ▼
       Python Vision       LLM       Image Model
          Service
```

其中 LangGraph 负责的不是“算法”，而是：

```text
状态管理
+
节点编排
+
条件路由
+
Tool Calling
+
多步骤任务
+
异常处理
+
持久化
```

这正是 LangGraph 的强项。([LangChain AI][1])

---

# 二、你们两个人的边界

这个一定要先确定。

## 你：Agent

```text
Python
LangGraph
    │
    ├── Graph
    ├── State
    ├── Node
    ├── Edge
    ├── Tool
    ├── Prompt
    ├── Memory
    └── Agent编排
```

## 你搭档：Vision Service

```text
Python
FastAPI
    │
    ├── OpenCV
    ├── Colour-Science
    ├── 校色
    ├── 取色
    ├── ΔE2000
    ├── ROI
    └── 热力图
```

两边通过：

```text
HTTP API
```

连接。

---

# V2.0 三服务架构设计

> **🎯 V2.0 核心目标**：实现完整的智能体服务边界，支持多步骤任务编排。

## V2.0 服务边界

### 整体架构

```text
                         用户
                          │
             ┌────────────┴────────────┐
             │                         │
        快捷工具入口                 AI 对话
             │                         │
             └────────────┬────────────┘
                          ▼
               ┌─────────────────────┐
               │     Go 后端         │
               │    (主服务)         │
               │  用户认证/会话管理   │
               └──────────┬──────────┘
                          │
                     HTTP/gRPC
                          ▼
               ┌─────────────────────┐
               │  Python 智能体       │
               │   (LangGraph)       │
               │  AI编排/Tool Calling│
               └──────────┬──────────┘
                          │
                     HTTP/gRPC
                          ▼
               ┌─────────────────────┐
               │  远程视觉服务        │
               │  (OpenCV+LLM)       │
               │  校色/取色/比对      │
               └─────────────────────┘
```

### 服务职责划分

#### 1. Go 后端（主服务）

```text
职责：
├── 用户管理
│   ├── 注册/登录/登出
│   ├── Token认证
│   └── 用户信息
├── 会话管理
│   ├── 创建会话
│   ├── 保存消息
│   ├── 历史记录
│   └── 会话持久化
├── 图片管理
│   ├── 上传/存储
│   ├── 访问控制
│   └── 清理策略
├── API网关
│   ├── 前端接口
│   ├── 路由转发
│   └── 限流/鉴权
└── 业务逻辑
    ├── 取色历史
    ├── 比对记录
    └── 用户偏好

技术栈：
├── Go + Gin
├── MySQL（用户/会话数据）
├── Redis（Token缓存）
└── 文件存储（图片）
```

#### 2. Python 智能体（LangGraph）

```text
职责：
├── AI编排
│   ├── 意图识别
│   ├── 任务分解
│   ├── 工具调度
│   └── 结果整合
├── 状态管理
│   ├── Agent状态
│   ├── 对话上下文
│   ├── 颜色上下文
│   └── 工具结果
├── 记忆系统
│   ├── 短期记忆（Checkpointer）
│   └── 长期记忆（Store）
├── LLM调用
│   ├── 多模态模型
│   ├── 文本生成
│   └── 语义分析
└── 工具执行
    ├── Vision Tools
    ├── Semantic Tools
    └── Generation Tools

技术栈：
├── Python + LangGraph
├── FastAPI（HTTP服务）
├── LangChain（工具封装）
└── Checkpointer（状态持久化）
```

#### 3. 远程视觉服务（搭档提供）

```text
职责：
├── 图片校色
│   ├── 色彩空间转换
│   ├── 白平衡校正
│   └── 颜色准确性验证
├── 颜色取值
│   ├── 单点取色
│   ├── 多格式输出
│   └── 取色历史
├── 颜色比对
│   ├── ΔE2000计算
│   ├── ROI区域比对
│   └── 热力图生成
└── 高级功能
    ├── 图片风格分析
    ├── 配色方案生成
    └── 颜色语义解读

技术栈：
├── Python + FastAPI
├── OpenCV（图像处理）
├── Colour-Science（色彩计算）
└── 多模态LLM（语义分析）
```

## V2.0 通信协议设计

### 1. Go → Python智能体

```text
协议：HTTP REST API
认证：内部服务密钥
超时：30秒
重试：3次，指数退避

接口：
POST /api/agent/chat
POST /api/agent/task
GET  /api/agent/session/{id}
```

请求示例：
```json
{
  "session_id": "sess_123",
  "user_id": "user_456",
  "message": "帮我校正这张照片",
  "image_url": "https://example.com/photo.jpg",
  "context": {
    "previous_colors": [],
    "user_preferences": {}
  }
}
```

响应示例：
```json
{
  "success": true,
  "response": "已为您校正照片，校正后色差为0.12",
  "tool_results": {
    "corrected_image_url": "https://example.com/corrected.jpg",
    "distance": 0.12,
    "passed": true
  },
  "state": {
    "current_image": "corrected.jpg",
    "color_context": {}
  }
}
```

### 2. Python智能体 → 远程视觉服务

```text
协议：HTTP REST API
认证：API密钥
超时：15秒
重试：2次

接口：
POST /api/vision/correct
POST /api/vision/pick
POST /api/vision/compare
POST /api/vision/analyze
```

请求示例（校色）：
```json
{
  "image_url": "https://example.com/photo.jpg",
  "options": {
    "quality": "high",
    "format": "jpg"
  }
}
```

响应示例：
```json
{
  "success": true,
  "original_url": "https://example.com/original.jpg",
  "corrected_url": "https://example.com/corrected.jpg",
  "distance": 0.12,
  "threshold": 0.6,
  "elapsed_time": 2.5
}
```

## V2.0 状态管理策略

### 1. Go后端状态管理

```text
存储：MySQL + Redis

数据：
├── 用户会话
│   ├── session_id
│   ├── user_id
│   ├── messages[]
│   ├── created_at
│   └── updated_at
├── 图片记录
│   ├── image_id
│   ├── user_id
│   ├── url
│   ├── metadata
│   └── expires_at
└── 业务数据
    ├── 取色历史
    ├── 比对记录
    └── 用户偏好

特点：
- 持久化存储
- 用户级隔离
- 过期清理
```

### 2. Python智能体状态管理

```text
存储：LangGraph Checkpointer + 内存

数据：
├── Agent状态
│   ├── messages[]
│   ├── current_task
│   ├── tool_results
│   └── error_state
├── 颜色上下文
│   ├── current_image
│   ├── corrected_image
│   ├── selected_color
│   ├── comparison_result
│   └── semantic_info
└── 任务状态
    ├── task_type
    ├── progress
    └── next_steps

特点：
- 线程级隔离
- 自动恢复
- 轻量级
```

## V2.0 错误处理策略

### 1. 服务间错误传播

```text
错误链：
用户请求 → Go后端 → Python智能体 → 远程视觉服务

错误类型：
├── 网络错误
│   ├── 连接超时
│   ├── 服务不可用
│   └── DNS解析失败
├── 业务错误
│   ├── 参数错误
│   ├── 权限不足
│   └── 资源不存在
└── 系统错误
    ├── 服务内部错误
    ├── 资源耗尽
    └── 依赖服务故障

处理策略：
├── 重试机制
│   ├── 网络错误：3次重试
│   ├── 业务错误：不重试
│   └── 系统错误：2次重试
├── 降级策略
│   ├── 视觉服务不可用：返回缓存结果
│   ├── 智能体不可用：直接调用视觉服务
│   └── 全部不可用：返回友好提示
└── 告警机制
    ├── 错误率监控
    ├── 响应时间监控
    └── 资源使用监控
```

### 2. 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "VISION_SERVICE_TIMEOUT",
    "message": "视觉服务响应超时",
    "details": {
      "service": "python-vision",
      "timeout": 15000,
      "retry_count": 3
    },
    "suggestion": "请稍后重试或联系技术支持"
  },
  "fallback": {
    "available": true,
    "message": "已为您缓存上次结果"
  }
}
```

## V2.0 部署架构

### 开发环境

```text
本地开发：
├── Go后端：localhost:3001
├── Python智能体：localhost:8000
├── 远程视觉服务：远程服务器
├── MySQL：localhost:3306
└── Redis：localhost:6379

启动方式：
├── 终端1：cd go-backend && go run main.go
├── 终端2：cd python-agent && uvicorn main:app --reload
└── 终端3：cd frontend && npm run dev
```

### 生产环境

```text
部署架构：
├── 阿里云ECS
│   ├── Go后端
│   │   ├── Nginx反向代理
│   │   ├── 应用服务
│   │   └── 文件存储
│   └── Python智能体
│       ├── FastAPI服务
│       ├── LangGraph运行时
│       └── 状态存储
├── 远程视觉服务
│   └── 搭档服务器
├── 数据库
│   ├── MySQL（阿里云RDS）
│   └── Redis（阿里云Redis）
└── 监控
    ├── 日志收集
    ├── 性能监控
    └── 告警通知
```

## V2.0 性能优化

### 1. 缓存策略

```text
缓存层级：
├── Go后端缓存
│   ├── Redis：用户Token、会话数据
│   ├── 本地缓存：热点数据
│   └── CDN：静态资源
├── Python智能体缓存
│   ├── 内存：当前任务状态
│   └── Redis：历史任务结果
└── 视觉服务缓存
    ├── Redis：图片处理结果
    └── 文件缓存：校正后图片

缓存策略：
├── 相同图片校色结果：24小时
├── 用户会话数据：7天
├── 热点API响应：5分钟
└── 静态资源：长期缓存
```

### 2. 异步处理

```text
异步场景：
├── 文生图任务
│   ├── 提交任务
│   ├── 后台处理
│   ├── 完成通知
│   └── 结果获取
├── 批量处理
│   ├── 多图校色
│   ├── 批量比对
│   └── 报告生成
└── 长时间任务
    ├── 进度查询
    ├── 取消支持
    └── 超时处理
```

---

# 三、为什么你的项目适合 LangGraph

你的项目并不是单纯：

```text
用户 → LLM → Tool → 用户
```

而可能是：

```text
用户
 ↓
理解任务
 ↓
校正图片
 ↓
取颜色
 ↓
颜色分析
 ↓
配色
 ↓
生成图片
```

这就天然适合 Graph。

LangGraph 的核心抽象就是：

```text
State
 ↓
Node
 ↓
Edge
 ↓
Node
```

Node 负责执行逻辑，Edge 决定下一步走哪里。([LangChain AI][2])

---

# 四、整个 Graph 怎么设计

我建议你的 V1 Graph：

```text
START
  │
  ▼
┌──────────────┐
│ Intent Node  │
│ 意图识别      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Agent Node   │
│ LLM决策       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Tool Router  │
└──────┬───────┘
       │
 ┌─────┼───────────────┐
 ▼     ▼               ▼
校色   取色             比对
 │     │               │
 └─────┼───────────────┘
       ▼
┌──────────────┐
│ Result Node  │
│ 结果处理      │
└──────┬───────┘
       │
       ▼
      END
```

但是这里有一个很重要的地方：

**不要把每个 Tool 都设计成一个 Node。**

例如：

```text
color_picker
color_compare
color_calibration
```

它们属于 Tool。

而：

```text
Agent Node
Tool Node
Result Node
```

才是 Graph Node。

LangGraph 自带 `ToolNode`，就是专门负责工具执行的预构建节点，并支持工具执行、错误处理、状态注入等能力。([GitHub][3])

---

# 五、核心 State 怎么设计

这是你使用 LangGraph 最重要的部分之一。

建议：

```text
ColorAgentState
```

大概：

```python
class ColorAgentState(TypedDict):

    messages: list

    user_id: str

    session_id: str

    current_image_url: str | None

    corrected_image_url: str | None

    current_color: dict | None

    comparison_result: dict | None

    task_type: str | None

    tool_result: dict | None

    error: dict | None
```

你可以把它理解成：

> **整个 Agent 当前正在处理的上下文。**

例如用户：

> “帮我把这张照片校正一下。”

State：

```text
current_image_url
    ↓
xxx.jpg

task_type
    ↓
color_calibration
```

调用 Python：

```text
corrected_image_url
    ↓
xxx_corrected.jpg
```

然后 State 更新：

```text
current_image_url
corrected_image_url
```

---

# 六、你这个项目最关键的是“颜色上下文”

我建议不要只存 messages。

单独维护：

```text
ColorContext
```

例如：

```text
ColorContext
│
├── image
├── corrected_image
│
├── selected_color
│   ├── HEX
│   ├── RGB
│   ├── HSL
│   └── Lab
│
├── comparison
│   ├── delta_e_2000
│   ├── threshold
│   ├── qualified
│   └── heatmap
│
└── semantic
    ├── color_name
    ├── temperature
    ├── saturation
    └── style
```

这样你的 Agent 就可以真正做到：

> “刚才取出来的那个颜色，再帮我推荐一下搭配。”

Agent 不需要重新取色。

---

# 七、Intent Node 怎么设计

第一步先判断：

```text
用户到底想干什么？
```

比如：

```text
图片校正
取色
颜色转换
颜色比对
颜色分析
配色
图生文
文生图
综合任务
```

例如：

```text
“帮我校正一下这张照片”
```

输出：

```json
{
    "intent": "color_calibration"
}
```

而：

> “先校正，再取一下中心颜色，然后告诉我适合什么颜色。”

输出：

```json
{
    "intent": "multi_step_color_task"
}
```

---

# 八、Agent Node 才是真正的大脑

Intent Node 负责：

> **判断是什么任务。**

Agent Node 负责：

> **决定下一步做什么。**

例如：

```text
用户：
先帮我校正照片，然后告诉我材料是什么颜色。
```

Agent Node：

```text
第一步：
color_calibration

第二步：
color_picker

第三步：
color_semantic
```

于是 Graph：

```text
Agent
 ↓
Tool
 ↓
Agent
 ↓
Tool
 ↓
Agent
 ↓
Tool
 ↓
Result
```

这就是你这个项目最核心的 Agent 编排。

---

# 九、Tool 层怎么设计

建议分三组。

```text
tools/
│
├── vision/
│   ├── color_calibration
│   ├── color_picker
│   └── color_comparison
│
├── semantic/
│   ├── color_semantic
│   ├── color_recommendation
│   └── image_style_analysis
│
└── generation/
    └── text_to_image
```

---

# 十、Vision Tool

### color_calibration

```text
输入：
image_url

输出：
corrected_image_url
```

内部：

```text
LangGraph
 ↓
ToolNode
 ↓
color_calibration
 ↓
HTTP
 ↓
搭档 FastAPI
 ↓
OpenCV
 ↓
返回结果
```

---

# 十一、color_picker

输入：

```text
image_url
x
y
```

输出：

```text
HEX
RGB
HSL
Lab
```

然后写入 State：

```text
state.current_color
```

这样后续 Agent 可以直接使用。

---

# 十二、color_comparison

输入：

```text
standard_image
sample_image
roi
threshold
```

输出：

```text
delta_e_2000
qualified
heatmap_url
```

再写：

```text
state.comparison_result
```

---

# 十三、Semantic Tool

比如：

```text
color_semantic
```

输入：

```text
HEX
RGB
Lab
```

LLM 输出：

```text
颜色名称
色彩倾向
情感
视觉风格
```

然后写入：

```text
state.semantic
```

---

# 十四、Generation Tool

例如：

```text
text_to_image
```

Agent：

```text
当前颜色
+
用户描述
+
配色方案
```

构造：

```text
Prompt
```

调用生图模型。

最后：

```text
generated_image_url
```

写入 State。

---

# 十五、V1.0 核心：图片校色功能实现

> **🎯 V1.0 重点**：当前只实现图片校色功能，其他功能后续迭代。

## 15.1 图片校色工具实现

基于 `Color_Correction.md` 接口，封装为 LangGraph 工具：

### 工具定义

```python
# tools/vision/calibration.py
from langchain_core.tools import tool
from typing import Optional
import httpx
import os

@tool
def color_calibration(image_path: str) -> dict:
    """
    图片颜色校正工具
    
    Args:
        image_path: 待校正的图片路径或URL
    
    Returns:
        dict: 校正结果，包含原图URL、校正图URL、距离值等
    """
    # 调用校色API
    api_url = "https://api3.ququan.net/quality/api/quality_check"
    
    # 准备文件上传
    with open(image_path, "rb") as f:
        files = {"image": f}
        response = httpx.post(api_url, files=files, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        return {
            "success": True,
            "original_url": result.get("original"),
            "corrected_urls": [r["corrected"] for r in result.get("results", [])],
            "distance": result.get("distance"),
            "passed": result.get("passed"),
            "threshold": result.get("threshold"),
            "elapsed_time": result.get("elapsed_time")
        }
    else:
        return {
            "success": False,
            "error": f"校色失败: {response.status_code}"
        }
```

### 接口响应格式（来自 Color_Correction.md）

**成功响应**：
```json
{
    "brand": "Unknown",
    "device_info": "未知设备",
    "distance": 0.2927,
    "elapsed_time": 9.859187602996826,
    "original": "https://f3.ququan.net/temp/check/...",
    "passed": true,
    "results": [
        {
            "corrected": "https://f3.ququan.net/temp/check/...",
            "distance": 0.0928,
            "model_name": "Apple iPhone17e/IMG_9921_1.jpg"
        }
    ],
    "threshold": 0.6
}
```

**失败响应**：
```json
{
    "brand": "Unknown",
    "distance": 0.7052,
    "error": "当前拍摄环境与标准环境不匹配",
    "passed": false,
    "threshold": 0.6
}
```

## 15.2 V1.0 简化流程

Graph 可以非常简单：

```text
START
  ↓
用户上传图片
  ↓
Intent Node（识别为校色任务）
  ↓
Agent Node（决定调用校色工具）
  ↓
ToolNode
  ↓
color_calibration（调用外部校色API）
  ↓
Result Node（组织校色结果）
  ↓
返回给用户
  ↓
END
```

这时候没必要复杂化，专注于图片校色这一核心功能。

---

# 十六、复杂任务才体现 LangGraph

例如：

> “帮我把这张材料照片校正一下，然后取一下中心颜色，分析这个颜色的特点，再给我推荐三种搭配。”

Graph：

```text
START
  │
  ▼
Intent
  │
  ▼
Agent
  │
  ▼
color_calibration
  │
  ▼
Agent
  │
  ▼
color_picker
  │
  ▼
Agent
  │
  ▼
color_semantic
  │
  ▼
Agent
  │
  ▼
color_recommendation
  │
  ▼
Result
  │
  ▼
END
```

这就是你的**核心 Demo**。

它比单纯展示：

> “我可以调用 Python 接口”

有价值很多。

---

# 十七、再进一步：条件分支

比如用户：

> “帮我看看两张材料颜色一样不一样。”

Graph：

```text
Intent
 ↓
Agent
 ↓
是否存在两张图片？
 │
 ├── 否 → 请求用户上传第二张
 │
 └── 是
      ↓
   color_comparison
      ↓
   ΔE2000
      ↓
   是否超过阈值？
      │
      ├── 是 → 不合格
      │
      └── 否 → 合格
```

这就是 LangGraph 的 Conditional Edge。

---

# 十八、再加入人工确认

例如：

> “我要用这张照片作为标准色。”

你可以：

```text
用户
 ↓
Agent
 ↓
判断需要确认
 ↓
Human Approval
 ↓
用户确认
 ↓
继续 Graph
```

LangGraph 本身支持 human-in-the-loop 和持久化执行，这种能力也是它适合复杂 Agent 工作流的原因之一。([LangChain AI][1])

---

# 十九、记忆怎么设计

## V1.0 记忆策略（简化版）

> **V1.0 版本简化策略**：暂不实现复杂的记忆功能，专注于图片校色核心功能。

第一版建议：

```text
简单的会话管理
+
当前任务上下文
+
基础状态传递
```

只需要：

```text
图片上下文
校色结果
简单的任务状态
```

长期用户画像和复杂记忆功能后续版本再做。

---

## V2.0 记忆策略（完整版）

> **V2.0 版本完整策略**：实现完整的长短期记忆系统，支持多步骤任务和用户偏好。

### 短期记忆（Thread Memory）

**实现方式**：LangGraph Checkpointer

```text
存储内容：
├── 当前对话
│   ├── messages[]
│   ├── 任务状态
│   └── 工具结果
├── 图片上下文
│   ├── current_image
│   ├── corrected_image
│   └── image_metadata
├── 颜色上下文
│   ├── selected_color
│   ├── color_history
│   └── comparison_result
└── 任务状态
    ├── task_type
    ├── progress
    └── next_steps

特点：
- 线程级隔离（thread_id）
- 自动持久化
- 支持断点恢复
- 轻量级，高性能
```

**存储位置**：
```text
├── 内存缓存（热数据）
└── Redis（持久化）
```

### 长期记忆（User Memory）

**实现方式**：LangGraph Store + MySQL

```text
存储内容：
├── 用户偏好
│   ├── 颜色偏好（低饱和、暖色、莫兰迪）
│   ├── 风格偏好（现代、复古、极简）
│   └── 工具使用习惯
├── 历史记录
│   ├── 常用颜色
│   ├── 历史任务
│   └── 收藏夹
├── 学习数据
│   ├── 用户反馈
│   ├── 满意度评分
│   └── 个性化推荐
└── 会话摘要
    ├── 对话主题
    ├── 关键决策
    └── 后续行动

特点：
- 用户级隔离（user_id）
- 跨会话持久化
- 支持查询和更新
- 定期同步到数据库
```

**存储位置**：
```text
├── MySQL（结构化数据）
├── Redis（缓存热点数据）
└── 文件系统（大文件）
```

### 记忆系统架构

```text
┌─────────────────────────────────────────┐
│            记忆系统架构                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌─────────────┐     │
│  │ 短期记忆    │    │ 长期记忆    │     │
│  │ (Checkpointer)│  │ (Store)     │     │
│  └──────┬──────┘    └──────┬──────┘     │
│         │                  │            │
│         ▼                  ▼            │
│  ┌─────────────────────────────────┐   │
│  │         统一记忆接口             │   │
│  │    MemoryManager               │   │
│  └─────────────────────────────────┘   │
│                    │                    │
│                    ▼                    │
│  ┌─────────────────────────────────┐   │
│  │         存储层                   │   │
│  │  ├── Redis（热数据）             │   │
│  │  ├── MySQL（持久化）             │   │
│  │  └── 文件系统（大文件）          │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 记忆管理接口

```python
# memory_manager.py
class MemoryManager:
    def __init__(self):
        self.checkpointer = RedisCheckpointer()
        self.store = MySQLStore()
    
    # 短期记忆操作
    def get_thread_state(self, thread_id: str) -> dict:
        """获取线程状态"""
        pass
    
    def update_thread_state(self, thread_id: str, state: dict):
        """更新线程状态"""
        pass
    
    # 长期记忆操作
    def get_user_memory(self, user_id: str) -> dict:
        """获取用户长期记忆"""
        pass
    
    def update_user_memory(self, user_id: str, memory: dict):
        """更新用户长期记忆"""
        pass
    
    def search_memory(self, user_id: str, query: str) -> list:
        """搜索用户记忆"""
        pass
```

### 记忆数据流

```text
用户交互
    ↓
┌─────────────┐
│  短期记忆    │ ← 当前对话上下文
│  (Checkpointer)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Agent处理   │
│  (LangGraph) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  长期记忆    │ ← 用户偏好/历史
│  (Store)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  持久化存储  │ ← MySQL/Redis
└─────────────┘
```

---

# 二十一、项目目录我建议这样

## V2.0 完整项目目录

```text
color-vision-agent/
│
├── app/
│   │
│   ├── graph/
│   │   ├── state.py              # Agent状态定义
│   │   ├── nodes.py              # 节点实现
│   │   ├── edges.py              # 边和路由逻辑
│   │   └── graph.py              # 图构建和配置
│   │
│   ├── agents/
│   │   ├── color_agent.py        # 主Agent实现
│   │   └── sub_agents/
│   │       ├── vision_agent.py   # 视觉处理子Agent
│   │       └── semantic_agent.py # 语义分析子Agent
│   │
│   ├── tools/
│   │   ├── vision/
│   │   │   ├── calibration.py    # 图片校色工具
│   │   │   ├── picker.py         # 颜色取值工具
│   │   │   └── comparison.py     # 颜色比对工具
│   │   │
│   │   ├── semantic/
│   │   │   ├── color_semantic.py # 颜色语义分析
│   │   │   ├── recommendation.py # 配色推荐
│   │   │   └── style_analysis.py # 风格分析
│   │   │
│   │   └── generation/
│   │       └── text_to_image.py  # 文生图工具
│   │
│   ├── memory/                   # V2.0 新增：记忆系统
│   │   ├── manager.py            # 记忆管理器
│   │   ├── checkpointer.py       # 短期记忆（Checkpointer）
│   │   ├── store.py              # 长期记忆（Store）
│   │   └── utils.py              # 记忆工具函数
│   │
│   ├── services/
│   │   ├── vision_client.py      # 视觉服务客户端
│   │   ├── llm_client.py         # LLM服务客户端
│   │   ├── image_client.py       # 图片服务客户端
│   │   └── go_backend_client.py  # Go后端客户端
│   │
│   ├── schemas/
│   │   ├── color.py              # 颜色相关数据模型
│   │   ├── image.py              # 图片相关数据模型
│   │   ├── tool.py               # 工具相关数据模型
│   │   ├── memory.py             # 记忆相关数据模型
│   │   └── api.py                # API请求/响应模型
│   │
│   ├── config/
│   │   ├── settings.py           # 配置管理
│   │   ├── logging.py            # 日志配置
│   │   └── constants.py          # 常量定义
│   │
│   └── utils/
│       ├── http_client.py        # HTTP客户端工具
│       ├── retry.py              # 重试机制
│       └── validators.py         # 数据验证
│
├── api/
│   ├── chat.py                   # 聊天接口
│   ├── session.py                # 会话接口
│   ├── task.py                   # 任务接口
│   └── health.py                 # 健康检查
│
├── tests/                        # 测试目录
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── e2e/                      # 端到端测试
│
├── scripts/                      # 脚本目录
│   ├── start.sh                  # 启动脚本
│   ├── migrate.py                # 数据迁移
│   └── seed.py                   # 测试数据
│
├── docs/                         # 文档目录
│   ├── api.md                    # API文档
│   ├── architecture.md           # 架构文档
│   └── deployment.md             # 部署文档
│
├── docker/                       # Docker配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── requirements.txt              # Python依赖
├── pyproject.toml                # 项目配置
├── .env.example                  # 环境变量示例
└── README.md                     # 项目说明
```

核心就是：

```text
graph/
tools/
services/
schemas/
```

---

# 二十二、你和搭档的最终接口关系

最终：

```text
                 你的 Agent Service
                         │
                   LangGraph
                         │
                      Tool
                         │
                  HTTP / REST
                         │
                         ▼
               搭档 Vision Service
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
             校色        取色        比对
              │          │          │
            OpenCV     Color       ΔE2000
                       Science
```

你只需要知道：

```text
Tool Input
Tool Output
Error
```

而不需要关心：

```text
OpenCV具体怎么实现
算法具体怎么计算
```

---

# 二十三、你们两个人之间的协议

这个继续沿用之前的思路，但现在明确叫：

> **Vision Tool Contract**

### ① Tool名称

```text
color_calibration
color_picker
color_comparison
```

### ② 输入

```text
image_url
x
y
roi
threshold
```

### ③ 输出

```text
corrected_image_url
color
comparison
```

### ④ 错误

```text
INVALID_IMAGE
INVALID_COORDINATE
INVALID_ROI
PROCESSING_TIMEOUT
INTERNAL_ERROR
```

### ⑤ 性能

按照 PRD：

```text
取色 ≤ 1.5s
比对 ≤ 3s
```

并且整体达标率目标 ≥95%。

---

# 二十四、最终你这个项目的 Graph，我建议就做这张

```text
                         START
                           │
                           ▼
                  ┌────────────────┐
                  │  Intent Node   │
                  │    意图识别      │
                  └───────┬────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │   Agent Node   │◄──────────────┐
                  │  LLM任务决策     │               │
                  └───────┬────────┘               │
                          │                         │
                          ▼                         │
                  ┌────────────────┐               │
                  │    ToolNode    │               │
                  └───────┬────────┘               │
                          │                         │
            ┌─────────────┼─────────────┐           │
            ▼             ▼             ▼           │
       color_calibration color_picker color_compare │
            │             │             │           │
            └─────────────┼─────────────┘           │
                          ▼                         │
                  ┌────────────────┐               │
                  │  Update State  │               │
                  └───────┬────────┘               │
                          │                         │
                    是否需要继续？ ─────── 是 ──────┘
                          │
                          │ 否
                          ▼
                  ┌────────────────┐
                  │  Result Node   │
                  │ 结果组织/解释    │
                  └───────┬────────┘
                          │
                          ▼
                         END
```

这个架构我认为比你之前的“多个独立 Agent”方案更适合你目前的项目。

**最重要的是：你现在学习 LangGraph 时，可以把重点放在 `State → Node → Edge → ToolNode → Checkpointer → Multi-step Workflow` 这一整套体系上。**

而你的搭档只需要稳定提供：

```text
校色 API
取色 API
颜色比对 API
```

你就可以独立把整个 Agent 编排层跑起来。

如果以后 PRD 真正扩展到很多专业领域，再考虑把 `Vision Agent / Color Expert Agent / Generation Agent` 拆成多 Agent；**V1 没必要为了“多 Agent”而多 Agent。** LangGraph 本身也适合从确定性工作流逐步扩展到更复杂的 Agentic workflow。([LangChain AI][1])

[1]: https://langchain-ai.github.io/langgraph/index.html?utm_source=chatgpt.com "LangGraph overview - Docs by LangChain"
[2]: https://langchain-ai.github.io/langgraph/how-tos/state-reducers/?utm_source=chatgpt.com "Graph API overview - Docs by LangChain"
[3]: https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/workflows-agents.mdx?utm_source=chatgpt.com "docs/src/oss/langgraph/workflows-agents.mdx at main · langchain-ai/docs · GitHub"
[4]: https://langchain-ai.github.io/langgraph/how-tos/persistence-functional/?utm_source=chatgpt.com "Memory - Docs by LangChain"
