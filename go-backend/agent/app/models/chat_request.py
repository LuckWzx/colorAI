"""
聊天请求模型：POST /api/chat 的请求体
"""

from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import FeatureType, MessageRole


class ChatMessage(BaseModel):
    """聊天消息"""
    role: MessageRole
    content: str
    feature: Optional[FeatureType] = None
    images: Optional[list[str]] = None


class ChatRequest(BaseModel):
    """聊天请求"""
    session_id: Optional[str] = Field(None, alias="sessionId")
    message_id: Optional[str] = Field(None, alias="messageId")
    messages: list[ChatMessage]
    model: Optional[str] = "deepseek-flash"
