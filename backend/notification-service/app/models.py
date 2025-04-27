import uuid
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
from app.constant import NotificationStatus


class Notification(BaseModel):
    userId: uuid.UUID = Field(alias="user_id", default_factory=uuid.uuid4)
    type: str
    message: Optional[str] = None
    status: NotificationStatus
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "user_id": self.userId,
            "type": self.type,
            "message": self.message,
            "status": self.status,
            "created_at": self.createdAt,
            "updated_at": self.updatedAt,
        }

    class Config:
        validate_by_name = True
