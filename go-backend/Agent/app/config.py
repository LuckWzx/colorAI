"""
应用配置模块
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""
    
    # 服务配置
    APP_NAME: str = "ColorAI Agent"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # 服务器配置（使用 AGENT_PORT 避免与 Go 后端的 PORT 冲突）
    HOST: str = "0.0.0.0"
    AGENT_PORT: int = 8000
    
    # DeepSeek API配置
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_API_BASE: str = "https://api.deepseek.com"
    # 注意：旧的 deepseek-chat / deepseek-reasoner 已于 2026-07-24 停用（404）
    DEEPSEEK_MODEL: str = "deepseek-flash"
    # 思考模式开关。deepseek-flash 默认开启思考；本智能体带 tools 调用时
    # 需要回传 reasoning_content（LangChain 不回传会导致 400），故默认关闭。
    DEEPSEEK_THINKING: bool = False
    
    # 智能体配置
    AGENT_TEMPERATURE: float = 0.7
    AGENT_MAX_TOKENS: int = 4096
    
    # 允许的Origins（CORS配置）
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# 全局配置实例
settings = Settings()
