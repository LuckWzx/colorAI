"""
LangGraph 智能体核心模块
"""

from typing import Annotated, TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
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
            langchain_messages = []
            
            # 添加系统提示词
            langchain_messages.append(SystemMessage(content=SYSTEM_PROMPT))
            
            # 处理用户消息
            for msg in messages:
                if msg["role"] == "user":
                    content = msg["content"]
                    
                    # 如果有图片，添加到消息中
                    if msg.get("images"):
                        content_parts = [{"type": "text", "text": content}]
                        for img in msg["images"]:
                            content_parts.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                            })
                        langchain_messages.append(HumanMessage(content=content_parts))
                    else:
                        langchain_messages.append(HumanMessage(content=content))
            
            # 调用智能体
            result = await self.graph.ainvoke({"messages": langchain_messages})
            
            # 获取最后一条AI消息
            ai_message = result["messages"][-1]
            
            # 构建响应
            response = {
                "success": True,
                "message": {
                    "id": f"msg_{hash(ai_message.content) % 1000000:06d}",
                    "role": "assistant",
                    "type": "text",
                    "content": ai_message.content,
                    "metadata": None,
                    "createdAt": int(__import__('time').time() * 1000)
                },
                "usage": None
            }
            
            # 检查是否有工具调用结果
            if hasattr(ai_message, "tool_calls") and ai_message.tool_calls:
                # 如果有工具调用，尝试从后续消息中获取结果
                for msg in reversed(result["messages"]):
                    if hasattr(msg, "content") and msg.content and not hasattr(msg, "tool_calls"):
                        # 解析工具返回的JSON结果
                        try:
                            import json
                            tool_result = json.loads(msg.content)
                            if tool_result.get("success"):
                                # 根据工具类型设置message.type
                                tool_name = ai_message.tool_calls[0]["function"]["name"]
                                type_mapping = {
                                    "image_correction": "correct",
                                    "color_extraction": "pick",
                                    "color_comparison": "compare",
                                    "color_conversion": "convert",
                                    "phone_correction": "phone"
                                }
                                response["message"]["type"] = type_mapping.get(tool_name, "text")
                                response["message"]["metadata"] = tool_result
                                response["message"]["content"] = f"已为您完成{tool_name}操作"
                        except json.JSONDecodeError:
                            pass
                        break
            
            return response
            
        except Exception as e:
            return {
                "success": False,
                "message": None,
                "usage": None,
                "error": str(e)
            }


# 全局智能体实例
_agent_instance = None


def get_agent() -> ColorAgent:
    """获取智能体单例"""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = ColorAgent()
    return _agent_instance
