from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class MailchimpEventType(str, Enum):
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    OPEN = "open"
    CLICK = "click"
    PROFILE = "profile"
    CLEANED = "cleaned"
    CAMPAIGN = "campaign"


class MailchimpWebhookPayload(BaseModel):
    """
    Mailchimp sends webhook data as form-encoded fields.
    This model represents the parsed and normalized version.
    """

    type: MailchimpEventType
    fired_at: datetime = Field(alias="fired_at")

    # Subscriber fields (present on subscribe/unsubscribe/open/click)
    email: str | None = None
    email_type: str | None = None
    list_id: str | None = None

    # Campaign fields (present on open/click events)
    campaign_id: str | None = None
    campaign_subject: str | None = None

    # Click-specific
    url: str | None = None

    # Open-specific
    user_agent: str | None = None
    ip: str | None = None

    # Unsubscribe-specific
    reason: str | None = None

    # Raw extras not mapped above
    raw: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class ExcelRow(BaseModel):
    """Represents one row written to the Excel file."""

    timestamp: str
    event_type: str
    email: str
    list_id: str
    campaign_id: str
    campaign_subject: str
    url: str
    ip: str
    user_agent: str
    reason: str
