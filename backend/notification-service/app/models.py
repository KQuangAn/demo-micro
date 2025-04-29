import uuid
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
from app.constant import NotificationStatus


class Notification(BaseModel):
    subjectId: uuid.UUID = Field(alias="subjectId")
    type: str
    message: Optional[str] = None
    status: NotificationStatus
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "subjectId": str(self.subjectId),
            "type": self.type,
            "message": self.message,
            "status": self.status,
            "created_at": self.createdAt.isoformat(),
            "updated_at": self.updatedAt.isoformat(),
        }

    class Config:
        validate_by_name = True
