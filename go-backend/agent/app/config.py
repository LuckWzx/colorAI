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

    # 图片校色服务（搭档提供的接口，见 doc/Color_Correction.md）
    # 接口本身较慢（示例 elapsed_time ≈ 9.86s），超时要留足余量。
    CORRECTION_API_URL: str = "https://api3.ququan.net/quality/api/quality_check"
    CORRECTION_TIMEOUT: float = 60.0          # 调用校色接口的超时
    CORRECTION_RETRY: int = 1                 # 校色接口失败重试次数（仅对超时/5xx 重试）
    CORRECTION_DOWNLOAD_TIMEOUT: float = 30.0 # 下载 image_url 的超时

    # 允许的Origins（CORS配置）
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# 全局配置实例
settings = Settings()
