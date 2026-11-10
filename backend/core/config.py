import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/bussologic")
    MONGODB_DB: str = os.getenv("MONGODB_DB", "bussologic")  # used when the URI has no /dbname path
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "bussologic-super-secure-secret-key-2026")
    SESSION_COOKIE: str = "intelliflow_employee_session"
    
    # LLM Settings
    ENABLE_LLM: bool = os.getenv("ENABLE_LLM", "false").lower() in ("true", "1", "yes")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_API_URL: str = os.getenv("LLM_API_URL", "https://api.openai.com/v1")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
