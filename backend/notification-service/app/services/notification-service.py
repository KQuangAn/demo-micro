import json
import boto3
import psycopg2
import requests
from typing import List
from time import sleep
from requests.exceptions import RequestException

# AWS Setup
eventbridge_client = boto3.client('events')
sqs_client = boto3.client('sqs')
QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/YOUR_QUEUE_NAME'

# GraphQL Endpoint for updating notifications in PostgreSQL
GRAPHQL_URL = 'http://your-graphql-api-endpoint/graphql'

# Function to fetch events from SQS
def get_sqs_messages(queue_url: str, max_messages: int = 10, wait_time: int = 10):
    response = sqs_client.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=max_messages,
        WaitTimeSeconds=wait_time
    )
    messages = response.get('Messages', [])
    return messages

# Function to delete a message from SQS after processing
def delete_message_from_sqs(receipt_handle: str):
    sqs_client.delete_message(
        QueueUrl=QUEUE_URL,
        ReceiptHandle=receipt_handle
    )

# Function to send a notification (can be email/SMS)
def send_notification(notification_data: dict) -> bool:
    try:
        # Simulate sending a notification (this could be an email/SMS API call)
        print(f"Sending notification: {notification_data}")
        # Example: sending a dummy email notification
        # response = requests.post('YOUR_NOTIFICATION_API', json=notification_data)
        # If sending is successful, return True
        return True
    except RequestException as e:
        print(f"Error sending notification: {e}")
        return False

# Function to update PostgreSQL via GraphQL
def update_postgres_notification_status(notification_id: str, status: str):
    query = """
        mutation UpdateNotificationStatus($notificationId: String!, $status: String!) {
            updateNotificationStatus(notificationId: $notificationId, status: $status) {
                id
                status
            }
        }
    """
    variables = {
        'notificationId': notification_id,
        'status': status
    }

    try:
        response = requests.post(
            GRAPHQL_URL,
            json={'query': query, 'variables': variables}
        )

        if response.status_code == 200:
            print(f"Successfully updated notification {notification_id} status to {status}")
        else:
            print(f"Error updating notification status: {response.text}")
    except RequestException as e:
        print(f"Error making GraphQL request: {e}")

# Main loop to listen to SQS and process messages
def process_sqs_messages():
    while True:
        messages = get_sqs_messages(QUEUE_URL)

        if not messages:
            print("No new messages in queue. Waiting...")
            sleep(5)  # Wait for 5 seconds before polling again
            continue

        for message in messages:
            # Extract the notification data
            notification_data = json.loads(message['Body'])

            notification_id = notification_data.get('notification_id')
            user_id = notification_data.get('user_id')
            content = notification_data.get('content')

            print(f"Processing notification {notification_id} for user {user_id}")

            # Send the notification (email/SMS, etc.)
            notification_sent = send_notification(notification_data)

            if notification_sent:
                # Update notification status to 'sent' in PostgreSQL via GraphQL
                update_postgres_notification_status(notification_id, "sent")
            else:
                # If sending failed, mark status as 'failed'
                update_postgres_notification_status(notification_id, "failed")

            # Delete the message from SQS after processing
            delete_message_from_sqs(message['ReceiptHandle'])

if __name__ == "__main__":
    process_sqs_messages()
