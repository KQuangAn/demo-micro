import json
from app.constant import EventType
from app.models import Notification
from app.db import db


def create_notification(message, event_type):
    try:
        user_id = message['detail'].get('user_id')
        order_id = message['detail'].get('id')
        notification = Notification(
            user_id=user_id,
            message=json.dumps(message),
            type=event_type,
            order_id=order_id
        )
        db.notifications.insert_one(notification.to_dict())
        print(f"Notification created for message {message} of type {event_type}")
    except Exception as e:
        print(f"Failed to create notification: {e}")

def create_failure_notification(original_event, error_message):
    try:
        create_notification(
            {"error": error_message, "original_event": original_event},
            EventType.NOTIFICATION_SENT_FAILED
        )
    except Exception as notification_error:
        print(f"Failed to create failure notification: {notification_error}")