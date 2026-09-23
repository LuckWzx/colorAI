"""
健康检查路由
"""

from fastapi import APIRouter

from app.models.health import HealthResponse
from app.config import settings


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查接口"""
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION
    )
