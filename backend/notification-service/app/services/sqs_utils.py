import os
import boto3

# Initialize SQS client
AWS_REGION = os.getenv('AWS_REGION')
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
MAX_NUMBER_OF_MESSAGE = int(os.getenv('MAX_NUMBER_OF_MESSAGE', 10))  
MAX_WAIT_TIME = int(os.getenv('MAX_WAIT_TIME', 20))  
sqs_client = boto3.client('sqs', region_name=AWS_REGION, endpoint_url=AWS_ENDPOINT, verify=False)

QUEUE_URL = os.getenv("QUEUE_URL")

def get_sqs_messages():
    response = sqs_client.receive_message(
        QueueUrl=QUEUE_URL,
        MaxNumberOfMessages=MAX_NUMBER_OF_MESSAGE,
        WaitTimeSeconds=MAX_WAIT_TIME
    )
    return response.get('Messages', [])

def delete_message(receipt_handle: str):
    sqs_client.delete_message(
        QueueUrl=QUEUE_URL,
        ReceiptHandle=receipt_handle
    )