from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mailchimp_api_key: str
    mailchimp_webhook_secret: str
    excel_file_path: str = "./data/mailchimp_events.xlsx"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Single instance reused across the app via dependency injection
settings = Settings()
