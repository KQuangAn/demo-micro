import os
import boto3
import json
from app.constant import EventType
from app.models import Notification
from app.db import db
from dotenv import load_dotenv

load_dotenv()

QUEUE_URL = os.getenv('QUEUE_URL')
AWS_REGION = os.getenv('AWS_REGION')
sqs = boto3.client('sqs', region_name=AWS_REGION, endpoint_url=QUEUE_URL)

def receive_messages():
    print(QUEUE_URL)
    response = sqs.receive_message(
        QueueUrl=QUEUE_URL,
        MaxNumberOfMessages=10,
        WaitTimeSeconds=10
    )
    print("new messages ", response)
    for message in response.get('Messages', []):
        process_message(message)
        sqs.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=message['ReceiptHandle'])

def process_message(message):
    notification_data = json.loads(message['Body'])
    detail_type = notification_data['detail-type']
    userId = notification_data['detail']['userID']
    print(message)
    # Using if-elif-else for conditional logic
    if detail_type == EventType.ORDER_UPDATED:
        # Handle order updated case
        print("Order updated")
    elif detail_type == EventType.ORDER_CANCELLED:
        # Handle order cancelled case
        print("Order cancelled")
    else:
        print("Unhandled event type")

def create_notification(message, recipient, type):
    notification = Notification(user_id=recipient, message=message, type=type)
    db.notifications.insert_one(notification.to_dict())
    
    # Send event to EventBridge
    # eventbridge.put_events(
    #     Entries=[
    #         {
    #             'Source': 'your.service.notification',
    #             'DetailType': 'notification.success',
    #             'Detail': json.dumps({'message': message, 'recipient': recipient}),
    #             'EventBusName': 'your_event_bus_name'
    #         }
    #     ]
    # )
