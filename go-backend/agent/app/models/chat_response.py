"""
聊天响应模型：POST /api/chat 的返回体
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.enums import FeatureType, MessageRole


class MessageResponse(BaseModel):
    """消息响应"""
    id: str
    role: MessageRole = MessageRole.ASSISTANT
    type: FeatureType
    content: str
    metadata: Optional[Any] = None
    created_at: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000), alias="createdAt")

    class Config:
        populate_by_name = True


class UsageInfo(BaseModel):
    """Token使用信息"""
    prompt_tokens: int = Field(0, alias="promptTokens")
    completion_tokens: int = Field(0, alias="completionTokens")
    total_tokens: int = Field(0, alias="totalTokens")

    class Config:
        populate_by_name = True


class ChatResponse(BaseModel):
    """聊天响应"""
    success: bool
    message: Optional[MessageResponse] = None
    usage: Optional[UsageInfo] = None
    error: Optional[str] = None
