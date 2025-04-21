import strawberry
from app.schemas import CreateNotificationSchema
from app.services.notification_service import create_notification
from app.models import Notification

@strawberry.type
class NotificationType:
    message: str
    recipient: str

@strawberry.type
class Query:
    notifications: list[NotificationType] = strawberry.field(resolver=lambda: list(db.notifications.find()))

@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_notification(self, input: CreateNotificationSchema) -> NotificationType:
        notification = create_notification(input.message, input.recipient)
        return NotificationType(message=notification.message, recipient=notification.recipient)

schema = strawberry.Schema(query=Query, mutation=Mutation)