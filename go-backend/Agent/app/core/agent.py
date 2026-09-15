"""
LangGraph 智能体核心模块
"""

import json
import time
from typing import Annotated, Optional, TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.config import settings
from app.tools.color_tools import get_all_tools


# 系统提示词
SYSTEM_PROMPT = """你是曲泉AI，一个专业的色彩智能体。你的专长是：
1. AI 一键校色：帮助用户校正图片的白平衡、色彩还原
2. 智能取色：从图片中提取主色调，支持 HEX/RGB/HSL/CMYK/Lab 等格式
3. 色彩空间转换：在不同色彩空间之间精准转换
4. 颜色对比：量化两个颜色的相似度（ΔE）
5. 手机拍摄校色：还原手机照片的人眼视觉真实色彩

请用专业、简洁、友好的语气回答用户关于色彩的问题。
当用户询问色彩理论、校色技巧、设备选择、行业应用等问题时，给出准确、实用的建议。
回答时适当使用色彩相关的专业术语，但要解释清楚。

你可以使用以下工具来帮助用户：
- image_correction: 图片一键校色
- color_extraction: 智能取色
- color_comparison: 颜色对比
- color_conversion: 颜色格式转换
- phone_correction: 手机拍摄校色

根据用户的意图，选择合适的工具来执行。如果用户没有明确指定工具，但提供了图片，你可以根据上下文判断使用哪个工具。
"""


# 工具名 → 消息类型映射（与前端消息卡片类型对齐）
TOOL_TYPE_MAPPING = {
    "image_correction": "correct",
    "color_extraction": "pick",
    "color_comparison": "compare",
    "color_conversion": "convert",
    "phone_correction": "phone",
}


def _to_data_url(image: str) -> str:
    """图片入参兼容两种形式：已是 dataURL 则原样返回，裸 base64 则补全前缀"""
    if image.startswith("data:"):
        return image
    return f"data:image/jpeg;base64,{image}"


class AgentState(TypedDict):
    """智能体状态"""
    messages: Annotated[list[BaseMessage], add_messages]


class ColorAgent:
    """色彩智能体"""
    
    def __init__(self):
        """初始化智能体"""
        # 初始化LLM
        self.llm = ChatOpenAI(
            model=settings.DEEPSEEK_MODEL,
            openai_api_key=settings.DEEPSEEK_API_KEY,
            openai_api_base=settings.DEEPSEEK_API_BASE,
            temperature=settings.AGENT_TEMPERATURE,
            max_tokens=settings.AGENT_MAX_TOKENS,
        )
        
        # 获取工具列表
        self.tools = get_all_tools()
        
        # 将工具绑定到LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 构建智能体图
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """构建LangGraph状态图"""
        
        # 定义节点
        def agent_node(state: AgentState):
            """智能体节点"""
            messages = state["messages"]
            
            # 确保系统提示词在最前面
            if not messages or not isinstance(messages[0], SystemMessage):
                messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
            
            response = self.llm_with_tools.invoke(messages)
            return {"messages": [response]}
        
        # 创建工具节点
        tool_node = ToolNode(self.tools)
        
        # 定义路由函数
        def should_continue(state: AgentState):
            """判断是否继续调用工具"""
            last_message = state["messages"][-1]
            
            # 如果最后一条消息包含工具调用，则继续
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                return "tools"
            
            # 否则结束
            return END
        
        # 构建状态图
        workflow = StateGraph(AgentState)
        
        # 添加节点
        workflow.add_node("agent", agent_node)
        workflow.add_node("tools", tool_node)
        
        # 设置入口点
        workflow.set_entry_point("agent")
        
        # 添加条件边
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                END: END
            }
        )
        
        # 工具节点返回到智能体节点
        workflow.add_edge("tools", "agent")
        
        # 编译图
        return workflow.compile()
    
    async def chat(self, messages: list[dict]) -> dict:
        """
        处理聊天请求
        
        Args:
            messages: 消息列表，格式为 [{"role": "user", "content": "...", "images": [...]}]
        
        Returns:
            响应字典
        """
        try:
            # 转换消息格式
            langchain_messages = [SystemMessage(content=SYSTEM_PROMPT)]
            
            # 处理用户消息
            for msg in messages:
                if msg["role"] != "user":
                    continue
                content = msg["content"]
                
                # 如果有图片，添加到消息中
                if msg.get("images"):
                    content_parts = [{"type": "text", "text": content}]
                    for img in msg["images"]:
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": _to_data_url(img)}
                        })
                    langchain_messages.append(HumanMessage(content=content_parts))
                else:
                    langchain_messages.append(HumanMessage(content=content))
            
            # 调用智能体
            result = await self.graph.ainvoke({"messages": langchain_messages})
            all_messages = result["messages"]
            
            # 最后一条 AI 消息即最终回复
            final_message = all_messages[-1]
            content = final_message.content or ""
            
            # 提取工具调用结果（tools -> agent 回环后，工具结果在 ToolMessage 上，
            # 最后一条 AI 消息不再携带 tool_calls，因此必须回扫整段历史）
            tool_name, tool_result = self._extract_tool_result(all_messages)
            
            message_type = "text"
            metadata = None
            if tool_result is not None:
                message_type = TOOL_TYPE_MAPPING.get(tool_name or "", "text")
                metadata = tool_result
                if not content:
                    content = f"已为您完成{tool_name}操作"
            
            now = int(time.time() * 1000)
            return {
                "success": True,
                "message": {
                    "id": f"msg_{now}",
                    "role": "assistant",
                    "type": message_type,
                    "content": content,
                    "metadata": metadata,
                    "createdAt": now,
                },
                "usage": None,
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": None,
                "usage": None,
                "error": str(e)
            }
    
    @staticmethod
    def _extract_tool_result(all_messages: list[BaseMessage]) -> tuple[Optional[str], Optional[dict]]:
        """
        从整段消息序列中提取「最后一次成功的工具调用」的工具名与结果
        
        工具执行结果存放在 ToolMessage 上，而不是最终回复的 AIMessage，
        因此不能只看最后一条消息的 tool_calls。
        
        Returns:
            (tool_name, tool_result)；没有任何成功的工具调用时返回 (None, None)
        """
        # 记录 tool_call_id → 工具名，作为 ToolMessage.name 缺失时的兜底
        tool_names: dict[str, str] = {}
        for msg in all_messages:
            for call in getattr(msg, "tool_calls", None) or []:
                call_id = call.get("id")
                name = call.get("name") or call.get("function", {}).get("name")
                if call_id and name:
                    tool_names[call_id] = name
        
        tool_name: Optional[str] = None
        tool_result: Optional[dict] = None
        
        for msg in all_messages:
            if not isinstance(msg, ToolMessage):
                continue
            try:
                parsed = json.loads(msg.content)
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(parsed, dict) or not parsed.get("success"):
                continue
            tool_name = getattr(msg, "name", None) or tool_names.get(msg.tool_call_id)
            tool_result = parsed
        
        return tool_name, tool_result


# 全局智能体实例
_agent_instance = None


def get_agent() -> ColorAgent:
    """获取智能体单例"""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = ColorAgent()
    return _agent_instance
