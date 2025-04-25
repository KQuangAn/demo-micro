import os
import boto3
import json

EVENT_BUS_NAME = os.getenv('EVENT_BUS_NAME')
AWS_REGION = os.getenv('AWS_REGION')
EVENT_BRIDGE_SOURCE = os.getenv('EVENT_BRIDGE_SOURCE')

# Create EventBridge client
eventbridge = boto3.client('events', region_name=AWS_REGION, verify=False)

def send_event_to_eventbridge(detail, detail_type):
    
    event = {
        'Source': EVENT_BRIDGE_SOURCE,
        'DetailType': detail_type,
        'Detail': json.dumps(detail),
        'EventBusName': EVENT_BUS_NAME
    }
    
    response = eventbridge.put_events(Entries=[event])
    print(f"Sent event to EventBridge: {response}")