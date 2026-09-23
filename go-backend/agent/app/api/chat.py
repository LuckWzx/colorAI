"""
聊天API路由
"""

from fastapi import APIRouter, HTTPException
from loguru import logger

from app.models.chat_request import ChatRequest
from app.models.chat_response import ChatResponse
from app.core.agent import get_agent


router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    聊天接口
    
    接收用户消息，通过智能体处理后返回响应。
    支持自由对话和快捷工具调用。
    """
    try:
        logger.info(f"收到聊天请求: session_id={request.session_id}, message_id={request.message_id}")
        
        # 获取智能体实例
        agent = get_agent()
        
        # 转换消息格式
        messages = []
        for msg in request.messages:
            message_dict = {
                "role": msg.role.value,
                "content": msg.content,
            }
            if msg.feature:
                message_dict["feature"] = msg.feature.value
            if msg.images:
                message_dict["images"] = msg.images
            messages.append(message_dict)
        
        # 调用智能体
        response = await agent.chat(messages)
        
        logger.info(f"智能体响应: success={response['success']}, type={response.get('message', {}).get('type') if response.get('message') else None}")
        
        return ChatResponse(**response)
        
    except Exception as e:
        logger.error(f"聊天请求处理失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
