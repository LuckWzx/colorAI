"""
健康检查模型：GET /health 的返回体
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str = "ok"
    version: str
