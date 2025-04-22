#!/bin/bash

# Wait for LocalStack to be ready
until $(curl --output /dev/null --silent --head --fail http://localhost:4566/_localstack/health); do
    printf '.'
    sleep 5
done

# Create the SQS queue
awslocal sqs create-queue --queue-name localstack-queue

awslocal events create-event-bus --name MyEventBus