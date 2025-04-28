from enum import Enum

class EventType:
    ORDER_PLACED = "order_placed"
    ORDER_UPDATED = "order_updated"
    ORDER_CANCELLED_BY_USER = "order_cancelled_by_user"
    ORDER_CANCELLED_INSUFFICIENT_INVENTORY = "order_cancelled_insufficient_inventory"
    ORDER_CANCELLED_INSUFFICIENT_FUNDS = "order_cancelled_insufficient_funds"
    ORDER_PROCESSED = "order_processed"
    ORDER_COMPLETED = "order_completed"
    INVENTORY_CREATED = "inventory_created"
    INVENTORY_UPDATED = "inventory_updated"
    INVENTORY_DELETED = "inventory_deleted"
    INVENTORY_RESERVED = "inventory_reserved"
    INVENTORY_RESERVATION_FAILED = "inventory_reservation_failed"
    NOTIFICATION_SENT_SUCCESS = "notification_sent_success"
    NOTIFICATION_SENT_FAILED = "notification_sent_failed"

    @classmethod
    def all_types(cls):
        return {value for name, value in cls.__dict__.items() if isinstance(value, str)}

    @classmethod
    def order_types(cls):
        return {
            cls.ORDER_PLACED,
            cls.ORDER_UPDATED,
            cls.ORDER_CANCELLED_BY_USER,
            cls.ORDER_CANCELLED_INSUFFICIENT_INVENTORY,
            cls.ORDER_CANCELLED_INSUFFICIENT_FUNDS,
            cls.ORDER_PROCESSED,
            cls.ORDER_COMPLETED,
        }
    
    @classmethod
    def inventory_types(cls):
        return {
            cls.INVENTORY_CREATED,
            cls.INVENTORY_UPDATED,
            cls.INVENTORY_DELETED,
            cls.INVENTORY_RESERVED,
            cls.INVENTORY_RESERVATION_FAILED,
        }

    @classmethod
    def notification_types(cls):
        return {
            cls.NOTIFICATION_SENT_SUCCESS,
            cls.NOTIFICATION_SENT_FAILED,
        }

class NotificationStatus(str, Enum):
    UNREAD = "unread"
    READ = "read"

    @classmethod
    def all_types(cls):
        return {status for status in cls.__dict__.values() if isinstance(status, str)}
   