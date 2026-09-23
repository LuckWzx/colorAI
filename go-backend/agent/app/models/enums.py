"""
枚举定义：消息角色、功能类型

被聊天请求 / 响应模型共用（见 chat_request.py / chat_response.py）。
"""

from enum import Enum


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
