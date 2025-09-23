import json 
import boto3
import urllib.parse

def lambda_handler(event, context):
    """
    AWS Lambda function handler that processes an event and returns a response.
    
    Args:
        event (dict): The event data passed to the Lambda function.
        context (LambdaContext): The runtime information of the Lambda function.

    Returns:
        dict: A response containing a status code and a message.
    """
    bucket = event["Record"][0]["s3"]["bucket"]["name"]
    key = urllib.parse.unquote_plus(event["Record"][0]["s3"]["object"]["key"] , encoding='utf-8')
    try:
        s3 = boto3.client('s3')
        response = s3.get_object(Bucket=bucket, Key=key)
        data = response['Body'].read().decode('utf-8')
        print("Data from S3:", data)
        print("Content type", response['ContentType'])
    except Exception as e:
        print(f"Error getting object {key} from bucket {bucket}. Error: {e}")
        raise e
    
    

    print("Received event:", json.dumps(event, indent=2))
    
    # Process the event here (this is just a placeholder)
    
    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }