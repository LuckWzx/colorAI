"""
LangGraph 智能体核心模块
"""

import json
import time
from typing import Annotated, Optional, TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from loguru import logger

from app.config import settings
from app.tools.color_tools import get_all_tools


# 系统提示词
#
# ⚠️ 只宣传**已上线**的能力。曾经的版本把 5 个能力全写进来（取色/对比/转换/手机校色），
# 而那时后 4 个工具是返回假数据的 stub —— 结果 LLM 会调用它们，把编造的色值包装成
# "取色完成！主色调为橙红，属于暖色系"这种看起来专业的结论。用户无法分辨真假。
# 未上线的能力必须在这里明说「还没上线」，并禁止编造。
SYSTEM_PROMPT = """你是曲泉AI，一个专业的色彩智能体。

【当前已上线的能力】
- **AI 一键校色**（工具 `image_correction`）：校正图片白平衡与色彩，还原真实色彩。
  用户上传照片并希望「校色 / 校正颜色 / 还原真实色彩 / 照片偏色发黄」时调用它。
- **色彩知识问答**（工具 `color_knowledge_search`）：语义检索色彩知识库（色彩理论、
  心理学、配色、文化象征、行业应用、颜色寓意）。用户问「什么是…」「为什么…」
  「…怎么配」「适合 X 的颜色」等知识性问题时调用它。
- **颜色数据查询**（工具 `color_lookup`）：按色值 / 色系 / 颜色名查询 310 种精选
  颜色的寓意与适用场景。用户提到具体色值（如 #A52A2A）、色系（如 红色系）、
  颜色名（如 赤褐）时调用它。

【知识答复规则 —— 必须遵守】
- 调用知识工具后**只依据返回内容作答**，并标注出处：知识问答标注 source
  （如「据《颜色知识问答1000题》」），颜色查询标明来自《颜色寓意全息宝典》。
- 返回为空（results=[] 或 matched=0）＝ 知识库里没有该内容，如实说明未收录，
  **绝对不要凭记忆编造**。
- 若补充库外的通用知识，必须声明「这是通用知识」，且不得为它声称有出处。
- **库内色值 ≠ 图片取色**：知识库的色值是配色参考资料，**不是**用户图片的取样
  结果，绝不能说成「从您的图片中提取 / 测量得到」。

【尚未上线的能力 —— 必须如实告知，绝不编造】
以下能力仍在开发中，**没有可用的工具**：
- 智能取色（从图片提取色值）
- 颜色对比（ΔE 色差量化）
- 色彩空间转换
- 手机拍摄校色

用户提出这些需求时，请**如实说明该功能尚未上线**，可简单介绍它未来能做什么，
并建议用户先试试「一键校色」。绝对不要：
- 编造取色 / 对比 / 转换的结果或数值（例如凭空给出 HEX 色值、相似度、ΔE）；
- 用 `image_correction` 去冒充其它功能（用户要取色时不要给他做校色）；
- 声称自己"完成了"某个尚未上线的操作。

【通用要求】
请用专业、简洁、友好的语气回答用户关于色彩的问题。知识性问题优先调用知识工具
核实后再作答；校色技巧、设备选择等问题给出准确、实用的建议；适当使用专业术语
并解释清楚。

图片会以 URL 形式出现在用户消息里（形如「[用户上传的图片 URL]」）。
调用 `image_correction` 时把该 URL 作为 `image_url` 传入，**不要传 base64**。
"""


# 工具名 → 消息类型映射（与前端消息卡片类型对齐）
#
# 这里保留 5 项是为了实现后不用再改；但**只有 get_all_tools() 里注册过的工具**
# 才可能真的产生结果。未实现的能力不要注册工具，详见 color_tools.py 末尾的说明块。
TOOL_TYPE_MAPPING = {
    "image_correction": "correct",
    "color_extraction": "pick",
    "color_comparison": "compare",
    "color_conversion": "convert",
    "phone_correction": "phone",
}


# feature → (工具名, 图片参数的参数名)
#
# 用户点了快捷工具按钮时，前端会带上 feature，这里就**确定性短路**：
# 代码直接调对应工具，不让 LLM 再判断一次（更快、不会选错、图片也不必进 LLM 上下文）。
# 契约见 ColorAI/src/API.md「feature 字段与工具选择」。
#
# 只登记「已实现且图片参数是 URL」的工具。其余四个仍是 stub，
# 入参是 base64 的 image_data，短路过去会因参数不匹配报错，故暂不登记 ——
# 它们仍然由 LLM 语义分析决定调用。实现一个登记一个。
FEATURE_TOOL_MAPPING: dict[str, tuple[str, str]] = {
    "correct": ("image_correction", "image_url"),
    # "pick":    ("color_extraction", "image_url"),
    # "compare": ("color_comparison", "image_url"),
    # "convert": ("color_conversion", "image_url"),
    # "phone":   ("phone_correction", "image_url"),
}


class AgentState(TypedDict):
    """智能体状态"""
    messages: Annotated[list[BaseMessage], add_messages]


class ColorAgent:
    """色彩智能体"""
    
    def __init__(self):
        """初始化智能体"""
        # 初始化LLM
        # 注意：deepseek-flash 默认开启「思考模式」。本智能体始终 bind_tools（请求带 tools），
        # 而官方规定「带 tools 的请求必须把每轮的 reasoning_content 原样回传，否则返回 400」，
        # langchain-openai 0.2.1 不会回传该字段，故默认关闭思考模式（DEEPSEEK_THINKING=False）。
        # 另：思考模式下 temperature 会被静默忽略，关闭后 temperature 才生效。
        self.llm = ChatOpenAI(
            model=settings.DEEPSEEK_MODEL,
            openai_api_key=settings.DEEPSEEK_API_KEY,
            openai_api_base=settings.DEEPSEEK_API_BASE,
            temperature=settings.AGENT_TEMPERATURE,
            max_tokens=settings.AGENT_MAX_TOKENS,
            extra_body={
                "thinking": {
                    "type": "enabled" if settings.DEEPSEEK_THINKING else "disabled"
                }
            },
        )
        
        # 获取工具列表
        self.tools = get_all_tools()
        # 工具名 → 工具对象，供 feature 短路时直接调用
        self._tool_by_name = {t.name: t for t in self.tools}
        
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
            messages: 完整对话历史，格式为
                      [{"role": "user", "content": "...", "feature": "correct", "images": ["http://..."]}]
                      images 是 **URL**（Go 侧已把 base64 落盘并替换），不是 dataURL。
        
        Returns:
            响应字典
        """
        try:
            # 转换消息格式（保留完整历史，含 assistant 轮次，用于会话记忆）
            langchain_messages = [SystemMessage(content=SYSTEM_PROMPT)]
            last_user: Optional[dict] = None

            for msg in messages:
                role = msg.get("role")

                if role == "assistant":
                    if msg.get("content"):
                        langchain_messages.append(AIMessage(content=msg["content"]))
                    continue
                if role != "user":
                    continue

                content = msg.get("content") or ""
                images = msg.get("images") or []

                if images:
                    # 图片以 URL 形式随文本交给 LLM：tool 的入参是 URL，而 LLM 只能通过
                    # 文本生成 tool 参数，所以 URL 必须在文本里。
                    # **不把图片字节塞进 HumanMessage** —— 校色/取色都在后端由 tool 完成，
                    # LLM 不需要「看见」像素，塞进去只会白烧 token、还要求模型支持视觉。
                    content = content + "\n\n[用户上传的图片 URL]\n" + "\n".join(f"- {u}" for u in images)

                langchain_messages.append(HumanMessage(content=content))
                last_user = msg

            # feature 非空 → 确定性短路，不让 LLM 选工具
            forced = self._resolve_forced_tool(last_user)

            if forced:
                tool_name, tool_args = forced
                logger.info(f"[chat] feature 短路 → 直接调用 {tool_name}")
                self._append_forced_tool_result(tool_name, tool_args, langchain_messages)
                # 用**不带 tools** 的 LLM 生成总结，避免它拿到结果后又调一次工具
                summary = await self.llm.ainvoke(langchain_messages)
                all_messages = langchain_messages + [summary]
                final_message = summary
            else:
                result = await self.graph.ainvoke({"messages": langchain_messages})
                all_messages = result["messages"]
                final_message = all_messages[-1]

            content = final_message.content or ""

            # 提取工具调用结果（工具结果在 ToolMessage 上，最终 AI 消息不携带 tool_calls，
            # 因此必须回扫整段历史）
            tool_name, tool_result = self._extract_tool_result(all_messages)

            message_type = "text"
            metadata = None
            if tool_result is not None:
                # 只有「产出卡片」的工具（TOOL_TYPE_MAPPING 里登记过的）才把结果放进 metadata；
                # 知识检索类工具不在表里 → type=text + metadata=None，
                # 防止 1–2 KB 检索原文落进 chat_messages.payload（§4.3）。
                mapped = TOOL_TYPE_MAPPING.get(tool_name or "")
                if mapped:
                    message_type = mapped
                    metadata = tool_result
                else:
                    logger.debug(f"[chat] 工具 {tool_name} 不产出卡片，结果仅用于本轮回复")
                if not content:
                    content = f"已为您完成{tool_name}操作" if mapped else "知识库查询已完成。"

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
            logger.exception("[chat] 处理失败")
            return {
                "success": False,
                "message": None,
                "usage": None,
                "error": str(e)
            }

    @staticmethod
    def _resolve_forced_tool(last_user: Optional[dict]) -> Optional[tuple[str, dict]]:
        """feature 非空时确定性地选定工具，返回 (工具名, 工具参数)

        返回 None 表示交给 LLM 语义分析。三种情况会返回 None：
          - 没有用户消息 / feature 为空
          - feature 未登记（对应的工具还没实现）
          - 图片类 feature 但用户没传图片 —— 交给 LLM 去追问用户
        """
        if not last_user:
            return None

        feature = last_user.get("feature")
        if not feature:
            return None

        entry = FEATURE_TOOL_MAPPING.get(feature)
        if not entry:
            logger.debug(f"[chat] feature={feature} 未登记短路工具，交给 LLM 判断")
            return None

        tool_name, image_arg = entry
        images = last_user.get("images") or []
        if not images:
            logger.debug(f"[chat] feature={feature} 但没有图片，交给 LLM 追问")
            return None

        return tool_name, {image_arg: images[0]}

    def _append_forced_tool_result(
        self, tool_name: str, tool_args: dict, langchain_messages: list[BaseMessage]
    ) -> None:
        """直接执行工具，并把 (AIMessage.tool_calls, ToolMessage) 追加进消息序列

        为什么要手工补这对消息：ToolMessage 必须挂在一条带 tool_calls 的 AIMessage
        后面才合法。补进去之后，后续 LLM 就能像正常 tool-calling 回环一样基于结果写总结，
        但**工具的选择权不在 LLM 手里** —— 快捷按钮这条链路是确定性的。
        """
        tool = self._tool_by_name.get(tool_name)
        if tool is None:
            logger.error(f"[chat] 短路工具 {tool_name} 不存在")
            return

        try:
            raw = tool.invoke(tool_args)
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"[chat] 短路调用 {tool_name} 抛异常")
            raw = {"success": False, "errorCode": "TOOL_INVOKE_FAILED", "error": f"工具执行失败: {exc}"}

        # ToolNode 对非字符串返回值会做 json.dumps，这里保持一致
        content = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
        call_id = f"call_{int(time.time() * 1000)}"

        langchain_messages.append(
            AIMessage(
                content="",
                tool_calls=[{"name": tool_name, "args": tool_args, "id": call_id, "type": "tool_call"}],
            )
        )
        langchain_messages.append(
            ToolMessage(content=content, tool_call_id=call_id, name=tool_name)
        )
    
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
