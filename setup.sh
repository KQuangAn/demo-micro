#!/bin/bash
set -e

# Wait for LocalStack to be ready
until $(curl --output /dev/null --silent --head --fail http://localhost:4566/_localstack/health); do
    printf '.'
    sleep 5
done

# # Create SQS Queues
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name orders-queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name notification-queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name inventory-queue

EVENT_BUS_NAME="evbus"
REGION="ap-southeast-1"

# Create EventBridge Event Bus if it doesn't exist
if ! aws --endpoint-url=http://localhost:4566 events list-event-buses | grep -q "$EVENT_BUS_NAME"; then
    echo "Creating event bus $EVENT_BUS_NAME..."
    aws --endpoint-url=http://localhost:4566 events create-event-bus --name "$EVENT_BUS_NAME"
else
    echo "Event bus $EVENT_BUS_NAME already exists."
fi

ORDER_SOURCE="com.order.service"
INVENTORY_SOURCE="com.inventory.service"
NOTIFICATION_SOURCE="com.notification.service"

# Create the EventBridge rules
aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_placed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_placed\"]
    }" \
    --description "Capture OrderPlaced events" \
    --region "${REGION}"

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_cancelled" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_cancelled\"]
    }" \
    --description "Capture OrderCanceled events" \
    --region "${REGION}"

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_reserved" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_reserved\"]
    }" \
    --description "Capture InventoryReserved events" \
    --region "${REGION}"

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_reservation_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_reservation_failed\"]
    }" \
    --description "Capture InventoryReservationFailed events" \
    --region "${REGION}"

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "notification_sent_success" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${NOTIFICATION_SOURCE}\"],
      \"detail-type\": [\"notification_sent_success\"]
    }" \
    --description "Capture notification_sent_success events" \
    --region "${REGION}"

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "notification_sent_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${NOTIFICATION_SOURCE}\"],
      \"detail-type\": [\"notification_sent_failed\"]
    }" \
    --description "Capture notification_sent_failed events" \
    --region "${REGION}"

# Add targets to the rules
TARGET_NOTIFICATION_ARN="arn:aws:sqs:${REGION}:000000000000:notification-queue"
TARGET_ORDERS_ARN="arn:aws:sqs:${REGION}:000000000000:orders-queue"
TARGET_INVENTORY_ARN="arn:aws:sqs:${REGION}:000000000000:inventory-queue"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_placed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_cancelled" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}" \
             "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_reserved" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_reservation_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "notification_sent_success" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "notification_sent_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}"