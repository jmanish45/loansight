from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-2506"
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    max_file_size_mb: int = 10
    allowed_extensions: list[str] = [".pdf", ".jpg", ".jpeg", ".png"]

    # Gemini rate-limiting / gateway settings
    gemini_rpm: int = 10            # requests per minute (free-tier safe)
    gemini_max_retries: int = 3     # max retries on 429/503
    gemini_concurrency: int = 1     # concurrent Gemini requests (1 = sequential)

    # Processing settings
    bank_statement_max_pages: int = 10  # max pages to process for bank statements
    prompt_version: str = "v2"          # bump this to invalidate caches

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
