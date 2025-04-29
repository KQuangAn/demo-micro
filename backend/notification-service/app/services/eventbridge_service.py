import os
import boto3
import json

EVENT_BUS_NAME = os.getenv('EVENT_BUS_NAME')
AWS_REGION = os.getenv('AWS_REGION')
EVENT_BRIDGE_SOURCE = os.getenv('EVENT_BRIDGE_SOURCE')
AWS_ENDPOINT = os.getenv('AWS_ENDPOINT')
session = boto3.Session(
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=AWS_REGION,
)
eventbridge = session.client('events', endpoint_url=AWS_ENDPOINT)

def send_event_to_eventbridge(detail, detail_type):
    
    event = {
        'Source': EVENT_BRIDGE_SOURCE,
        'DetailType': detail_type,
        'Detail': json.dumps(detail),
        'EventBusName': EVENT_BUS_NAME
    }
    
    response = eventbridge.put_events(Entries=[event])
    print(f"Sent event to EventBridge: {response}")