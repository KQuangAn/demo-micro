import logging
from datetime import datetime
from typing import Any

from fastapi import Request

from app.models.webhook import MailchimpEventType, MailchimpWebhookPayload

logger = logging.getLogger(__name__)


def _safe_datetime(value: str | None) -> datetime:
    """Parse Mailchimp's fired_at format: '2024-01-15 10:30:00'"""
    if not value:
        return datetime.utcnow()
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        logger.warning("Could not parse fired_at: %s, using now", value)
        return datetime.utcnow()


async def parse_mailchimp_form(request: Request) -> dict[str, Any]:
    """
    Mailchimp sends webhook data as application/x-www-form-urlencoded.
    Fields use bracket notation for nested data: data[email], data[id], etc.
    This function flattens them into a usable dict.
    """
    form = await request.form()
    raw: dict[str, Any] = {}

    for key, value in form.multi_items():
        raw[key] = value

    return raw


def build_payload(raw: dict[str, Any]) -> MailchimpWebhookPayload:
    """
    Map raw Mailchimp form fields to the typed MailchimpWebhookPayload model.

    Mailchimp field reference:
      Subscribe:   type, fired_at, data[email], data[list_id], data[email_type]
      Open:        type, fired_at, data[email], data[list_id], data[campaign_id],
                   data[ip], data[user_agent]
      Click:       type, fired_at, data[email], data[list_id], data[campaign_id], data[url]
      Unsubscribe: type, fired_at, data[email], data[list_id], data[reason]
    """
    event_type_raw = raw.get("type", "")

    try:
        event_type = MailchimpEventType(event_type_raw)
    except ValueError:
        logger.warning("Unknown event type received: %s", event_type_raw)
        event_type = MailchimpEventType.CAMPAIGN  # fallback

    return MailchimpWebhookPayload(
        type=event_type,
        fired_at=_safe_datetime(raw.get("fired_at")),
        email=raw.get("data[email]"),
        email_type=raw.get("data[email_type]"),
        list_id=raw.get("data[list_id]"),
        campaign_id=raw.get("data[campaign_id]"),
        campaign_subject=raw.get("data[subject]"),
        url=raw.get("data[url]"),
        user_agent=raw.get("data[user_agent]"),
        ip=raw.get("data[ip]"),
        reason=raw.get("data[reason]"),
        raw=raw,
    )
