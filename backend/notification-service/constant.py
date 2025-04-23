from enum import Enum

class OrderEvents(Enum):
    order_placed = "order_placed"
    inventory_reserved = "inventory_reserved"
    order_cancelled = "order_cancelled"
    inventory_reservation_failed = "inventory_reservation_failed"
    order_confirmed = "order_confirmed"
    order_cancelled_notification = "order_cancelled_notification"