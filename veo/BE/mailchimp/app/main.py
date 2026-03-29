import logging
import logging.config
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers.webhook_router import router as webhook_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "app": {"level": "DEBUG", "handlers": ["console"], "propagate": False},
        "uvicorn.access": {"level": "WARNING"},  # quieten access log noise
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown logic
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    excel_path = Path(settings.excel_file_path)
    excel_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Excel output path: %s", excel_path.resolve())
    logger.info("Mailchimp webhook ready at POST /webhooks/mailchimp?secret=<your-secret>")
    yield
    # Shutdown (nothing to clean up)
    logger.info("Shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Mailchimp Webhook Listener",
        description=(
            "Listens for Mailchimp subscribe and open events "
            "and appends them to an Excel file."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.include_router(webhook_router)

    @app.get("/health", tags=["Health"])
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return app


app = create_app()
