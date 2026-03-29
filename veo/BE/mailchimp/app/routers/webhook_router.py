import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import PlainTextResponse

from app.config import Settings, settings
from app.models.webhook import MailchimpEventType, MailchimpWebhookPayload
from app.services.excel_service import append_event_to_excel
from app.services.parser_service import build_payload, parse_mailchimp_form

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Mailchimp Webhooks"])

# Events we care about — ignore everything else
TRACKED_EVENTS = {MailchimpEventType.SUBSCRIBE, MailchimpEventType.OPEN}


def get_settings() -> Settings:
    return settings


def verify_secret(request: Request, cfg: Settings = Depends(get_settings)) -> None:
    """
    Validate the secret token passed as a query param.
    Register your webhook URL as:
      https://yoursite.com/webhooks/mailchimp?secret=YOUR_SECRET
    """
    secret = request.query_params.get("secret")
    if not secret or secret != cfg.mailchimp_webhook_secret:
        logger.warning(
            "Webhook request rejected — invalid or missing secret. IP: %s",
            request.client.host if request.client else "unknown",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )


@router.get(
    "/mailchimp",
    response_class=PlainTextResponse,
    summary="Mailchimp webhook verification",
    description="Mailchimp sends a GET request to verify the endpoint exists before saving.",
    dependencies=[Depends(verify_secret)],
)
async def verify_webhook() -> str:
    """
    Mailchimp fires a GET to this URL when you register the webhook.
    Must return 200 OK or Mailchimp will reject the registration.
    """
    logger.info("Mailchimp webhook verification GET received")
    return "OK"


async def _process_event(payload: MailchimpWebhookPayload, file_path: str) -> None:
    """Background task: append the event to Excel."""
    try:
        await append_event_to_excel(payload, file_path)
    except Exception as exc:
        logger.error(
            "Failed to write %s event for %s to Excel: %s",
            payload.type,
            payload.email,
            exc,
            exc_info=True,
        )


@router.post(
    "/mailchimp",
    response_class=PlainTextResponse,
    summary="Receive Mailchimp webhook events",
    description="Handles subscribe and open events. Returns 200 immediately; Excel write happens in background.",
    dependencies=[Depends(verify_secret)],
    status_code=status.HTTP_200_OK,
)
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    cfg: Settings = Depends(get_settings),
) -> str:
    """
    Main webhook handler.

    - Parses Mailchimp's form-encoded payload
    - Filters to only subscribe + open events
    - Appends to Excel in a background task (non-blocking)
    - Always returns 200 immediately to prevent Mailchimp retries
    """
    raw = await parse_mailchimp_form(request)
    logger.debug("Raw Mailchimp payload: %s", raw)

    payload = build_payload(raw)

    if payload.type not in TRACKED_EVENTS:
        logger.info("Ignoring untracked event type: %s", payload.type)
        return "OK"

    logger.info(
        "Received %s event — email: %s, campaign: %s",
        payload.type,
        payload.email or "n/a",
        payload.campaign_id or "n/a",
    )

    # Fire and forget — never block the response waiting for Excel write
    background_tasks.add_task(_process_event, payload, cfg.excel_file_path)

    return "OK"
