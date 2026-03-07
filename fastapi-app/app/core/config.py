from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI Microservice"
    API_V1_STR: str = "/api/v1"
    
    # Environment variables
    ENVIRONMENT: str = "development"
    
    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fastapi_db"
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
