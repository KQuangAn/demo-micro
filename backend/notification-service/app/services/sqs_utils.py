import os
import boto3

# Initialize SQS client
AWS_REGION = os.getenv('AWS_REGION')
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
sqs_client = boto3.client('sqs', region_name=AWS_REGION, endpoint_url=AWS_ENDPOINT, verify=False)

QUEUE_URL = os.getenv("QUEUE_URL")

def get_sqs_messages(max_messages: int = 10, wait_time: int = 10):
    response = sqs_client.receive_message(
        QueueUrl=QUEUE_URL,
        MaxNumberOfMessages=max_messages,
        WaitTimeSeconds=wait_time
    )
    return response.get('Messages', [])

def delete_message(receipt_handle: str):
    sqs_client.delete_message(
        QueueUrl=QUEUE_URL,
        ReceiptHandle=receipt_handle
    )