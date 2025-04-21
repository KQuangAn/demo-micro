from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import UTC, datetime

class Notification(BaseModel):
    user_id: int
    order_id: int = None
    type: str
    message: str
    status: str = 'unread'
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "order_id": self.order_id,
            "type": self.type,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at or datetime.now(),
            "updated_at": self.updated_at or datetime.now(),
        }