"""
ColorAI Agent 主应用
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from app.config import settings
from app.api import chat, health


# 配置日志
logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")
logger.add("logs/agent.log", rotation="10 MB", retention="7 days", level="DEBUG")


def create_app() -> FastAPI:
    """创建FastAPI应用"""
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="ColorAI 智能体服务 - 基于LangGraph的色彩处理AI助手",
    )
    
    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 注册路由
    app.include_router(health.router)
    app.include_router(chat.router)
    
    # 启动事件
    @app.on_event("startup")
    async def startup():
        logger.info(f"{settings.APP_NAME} v{settings.APP_VERSION} 启动中...")
        logger.info(f"服务地址: http://{settings.HOST}:{settings.AGENT_PORT}")
        logger.info(f"API文档: http://{settings.HOST}:{settings.AGENT_PORT}/docs")
    
    # 关闭事件
    @app.on_event("shutdown")
    async def shutdown():
        logger.info(f"{settings.APP_NAME} 正在关闭...")
    
    return app


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    logger.info("启动 Agent 服务...")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.AGENT_PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
