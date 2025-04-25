import json
from time import sleep
from app.services.sqs_utils import get_sqs_messages, delete_message
from app.services.notification_service import create_notification,create_failure_notification
from app.constant import EventType

def process_message(message):
    notification_data = json.loads(message['Body'])
    detail_type = notification_data.get('detail-type')

    print(f"Processing message: {detail_type}")

    if detail_type in EventType.ALL_TYPES:
        try:
            create_notification(notification_data, EventType.NOTIFICATION_SENT_SUCCESS)
            print(f"Handled event type: {detail_type}")
        except Exception as e:
            print(f"Error handling event type {detail_type}: {e}")
            create_failure_notification(notification_data, str(e))


def receive_messages():
    print("Listening for messages...")
    while True:
        messages = get_sqs_messages()
        if messages:
            for message in messages:
                process_message(message)
                delete_message(message['ReceiptHandle'])
        else:
            print("No new messages. Waiting...")
            sleep(5)

if __name__ == "__main__":
    receive_messages()