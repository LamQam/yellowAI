from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/chatbot_platform"

    # Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # Server
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"

    # CORS
    FRONTEND_URL: Optional[str] = "http://localhost:5173"

    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIRECTORY: str = "uploads"
    ALLOWED_FILE_TYPES: list = [
        "text/plain", "text/csv", "application/json",
        "application/pdf", "image/jpeg", "image/png"
    ]

    class Config:
        env_file = ".env"


settings = Settings()

# Create upload directory if it doesn't exist
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
