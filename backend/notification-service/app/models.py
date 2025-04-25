from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime, timezone 
class Notification(BaseModel):
    user_id: str
    order_id: str
    type: str
    message: str
    status: str = 'unread'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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