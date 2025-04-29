import json
from time import sleep
from app.services.sqs_utils import get_sqs_messages, delete_message
from app.services.notification_service import (
    create_notification,
    create_failure_notification,
)
from app.constant import EventType , NotificationStatus
from app.models import Notification
from app.services.eventbridge_service import send_event_to_eventbridge


def process_message(message):
    try:
        notification_data = json.loads(message["Body"])
        detail_type = notification_data.get("detail-type")

        print(f"Processing message: {message}")

        if (
            detail_type in EventType.all_types()
            and detail_type != EventType.NOTIFICATION_SENT_SUCCESS
            and detail_type != EventType.NOTIFICATION_SENT_FAILED
        ):
            # Handle different events: order and inventory
            if detail_type in EventType.order_types():
                notification = Notification(
                    subjectId=notification_data["detail"].get("userID"),
                    message=json.dumps(notification_data),
                    type=detail_type,
                    status=NotificationStatus.UNREAD
                )
                create_notification(notification)
                send_event_to_eventbridge(notification.to_dict(), EventType.NOTIFICATION_SENT_SUCCESS)
            if detail_type in EventType.inventory_types():
                notification = Notification(
                    subjectId=notification_data["detail"].get("id"),
                    message=json.dumps(notification_data),
                    type=detail_type,
                    status=NotificationStatus.UNREAD
                )
                create_notification(notification)
                send_event_to_eventbridge(notification.to_dict(), EventType.NOTIFICATION_SENT_SUCCESS)
            print(f"Handled event type: {detail_type}")
            return True

    except Exception as e:
        print(f"Error processing message: {e}")
        try:
            notification = Notification(
                subjectId=notification_data.get("detail", {}).get("id", "unknown"),
                message=str(notification_data),
                type=EventType.NOTIFICATION_SENT_FAILED,
                status=NotificationStatus.UNREAD
            )
            create_notification(notification)
            send_event_to_eventbridge(notification.to_dict(), EventType.NOTIFICATION_SENT_FAILED)
        except Exception as nested_e:
            print(f"Failed to create failure notification: {nested_e}")
    return False


def receive_messages():
    print("Listening for messages...")
    while True:
        messages = get_sqs_messages()
        if messages:
            for message in messages:
                if process_message(message):
                    delete_message(message["ReceiptHandle"])
        else:
            print("No new messages. Waiting...")
            sleep(5)


if __name__ == "__main__":
    receive_messages()
