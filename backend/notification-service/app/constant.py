from enum import Enum

class EventType:
    ORDER_PLACED = "order_placed"
    ORDER_UPDATED = "order_updated"
    ORDER_CANCELLED = "order_cancelled"
    INVENTORY_RESERVED = "inventory_reserved"
    INVENTORY_RESERVATION_FAILED = "inventory_reservation_failed"
    NOTIFICATION_SENT_SUCCESS = "notification_sent_success"
    NOTIFICATION_SENT_FAILED = "notification_sent_failed"

    @classmethod
    def all_types(cls):
        return {event for event in cls.__dict__.values() if not event.startswith("__")}


class NotificationStatus(str, Enum):
    UNREAD = "unread"
    READ = "read"

    @classmethod
    def all_types(cls):
        return {status for status in cls.__dict__.values() if isinstance(status, str)}
   