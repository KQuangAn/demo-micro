import os
import boto3
import json
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
    create_notification(notification_data['message'], notification_data['recipient'])

def create_notification(message, recipient):
    notification = Notification(message, recipient)
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
