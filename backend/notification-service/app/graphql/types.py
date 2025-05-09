from datetime import datetime
import strawberry
from app.services.notification_service import fetch_notifications, create_notification
from app.constant import EventType, NotificationStatus
from app.models import Notification
from typing import List
from enum import Enum
from strawberry.schema.name_converter import NameConverter
from strawberry.types.enum import EnumDefinition, EnumValue
from strawberry.schema import config
from uuid import UUID

@strawberry.federation.type(keys=["id"])
class NotificationType:
    id: str
    subjectId: UUID
    type: str
    message: str
    status: str
    createdAt: datetime
    updatedAt: datetime


@strawberry.enum
class EventTypeEnum(Enum):
    ORDER_PLACED = EventType.ORDER_PLACED
    ORDER_UPDATED = EventType.ORDER_UPDATED
    ORDER_CANCELLED_BY_USER = EventType.ORDER_CANCELLED_BY_USER
    ORDER_CANCELLED_INSUFFICIENT_INVENTORY = EventType.ORDER_CANCELLED_INSUFFICIENT_INVENTORY
    ORDER_CANCELLED_INSUFFICIENT_FUNDS = EventType.ORDER_CANCELLED_INSUFFICIENT_FUNDS
    ORDER_PROCESSED = EventType.ORDER_PROCESSED
    ORDER_COMPLETED = EventType.ORDER_COMPLETED
    INVENTORY_CREATED = EventType.INVENTORY_CREATED
    INVENTORY_UPDATED = EventType.INVENTORY_UPDATED
    INVENTORY_DELETED = EventType.INVENTORY_DELETED
    INVENTORY_RESERVED = EventType.INVENTORY_RESERVED
    INVENTORY_RESERVATION_FAILED = EventType.INVENTORY_RESERVATION_FAILED
    NOTIFICATION_SENT_SUCCESS = EventType.NOTIFICATION_SENT_SUCCESS
    NOTIFICATION_SENT_FAILED = EventType.NOTIFICATION_SENT_FAILED

@strawberry.enum
class NotificationStatusEnum(Enum):
    UNREAD = NotificationStatus.UNREAD
    READ = NotificationStatus.READ
   
class CustomNameConverter(NameConverter):
    def from_enum_value(
        self,
        enum: EnumDefinition, 
        enum_value: EnumValue,
    ) -> str:
        return enum_value.name.upper()


@strawberry.field
def get_all_notifications() -> List[NotificationType]:
    return fetch_notifications()


@strawberry.field
def get_notifications_by_subject_id(subjectId: int) -> List[NotificationType]:
    return fetch_notifications(subjectId=subjectId)


@strawberry.field
def get_notifications_by_status(status: str) -> List[NotificationType]:
    return fetch_notifications(status=status)


@strawberry.type
class Query:
    all_notifications: List[NotificationType] = get_all_notifications
    get_notifications_by_subject_id: List[NotificationType] = get_notifications_by_subject_id
    notifications_by_status: List[NotificationType] = get_notifications_by_status


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_notification(
        self,
        subject_id: str,
        message: str,
        event_type: str,
    ) -> NotificationType:
        if event_type not in vars(EventType).values():
            raise ValueError("Invalid event type provided")

        notification = Notification(
            subjectId=subject_id,
            message=message,
            type=event_type,
            status=NotificationStatus.UNREAD
        )
        inserted = create_notification(notification)

        return NotificationType(
            id=str(inserted["_id"]),
            subjectId=inserted["subjectId"],
            type=inserted["type"],
            message=inserted["message"],
            status=inserted["status"],
            createdAt=inserted["createdAt"],
            updatedAt=inserted["updatedAt"],
        )


schema = strawberry.federation.Schema(
    query=Query,
    mutation=Mutation,
    enable_federation_2=True,
    config=config.StrawberryConfig(name_converter=CustomNameConverter()),
)
