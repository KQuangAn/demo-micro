import json
from app.constant import EventType
from app.models import Notification
from app.db import db

def fetch_notifications(userId: int = None, status: str = None):
    try:
        query_filter = {}
        
        if userId is not None:
            query_filter["user_id"] = userId
        
        if status is not None:
            query_filter["status"] = status

        notifications = db.notifications.find(query_filter)
        print(notifications)

        notifications_list = [
            Notification(
                id=str(notification["_id"]), 
                userId=notification["user_id"], 
                type=notification["type"],
                message=notification.get("message"),
                status=notification.get("status"),
                createdAt=notification.get("created_at"), 
                updatedAt=notification.get("updated_at"),
            )
            for notification in notifications
        ]
        return notifications_list
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return []

def create_notification(notification: Notification):
    try:
        notif_dict = notification.to_dict()
        result = db.notifications.insert_one(notif_dict)
        notif_dict["_id"] = str(result.inserted_id)
        print(f"Notification created for user {notification.userId}")
        return notif_dict
    except Exception as e:
        print(f"Failed to create notification: {e}")
        raise

def create_failure_notification(original_event, error_message):
    try:
        create_notification(
            {"error": error_message, "original_event": original_event},
            EventType.NOTIFICATION_SENT_FAILED,
        )
    except Exception as notification_error:
        print(f"Failed to create failure notification: {notification_error}")
