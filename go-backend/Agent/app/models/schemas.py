"""
数据模型定义
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum
from datetime import datetime


class MessageRole(str, Enum):
    """消息角色"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class FeatureType(str, Enum):
    """功能类型"""
    TEXT = "text"
    CORRECT = "correct"
    PICK = "pick"
    COMPARE = "compare"
    CONVERT = "convert"
    PHONE = "phone"


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
    model: Optional[str] = "deepseek-chat"


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


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str = "ok"
    version: str
