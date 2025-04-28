#!/bin/bash
set +e #ignore err 

export AWS_REGION="ap-southeast-1"
export AWS_DEFAULT_REGION="ap-southeast-1"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_ENDPOINT_URL="http://localhost:4566"
# Wait for LocalStack to be ready
until $(curl --output /dev/null --silent --head --fail http://localhost:4566/_localstack/health); do
    printf '.'
    sleep 5
done

EVENT_BUS_NAME="evbus"
REGION="ap-southeast-1"

# Create EventBridge Event Bus if it doesn't exist
if ! aws --endpoint-url=http://localhost:4566 events list-event-buses | grep -q "$EVENT_BUS_NAME"; then
    echo "Creating event bus $EVENT_BUS_NAME..."
    aws --endpoint-url=http://localhost:4566 events create-event-bus --name "$EVENT_BUS_NAME" &
else
    echo "Event bus $EVENT_BUS_NAME already exists."
fi


# Create SQS Queues
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name orders-queue &
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name orders-dead-letter-queue &
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name notification-queue &
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name notification-dead-letter-queue &
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name inventory-queue &
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name inventory-dead-letter-queue &


#config main queue
ORDERS_DLQ_URL=$(aws --endpoint-url=http://localhost:4566 sqs get-queue-url --queue-name orders-dead-letter-queue --output text --query QueueUrl)
INVENTORY_DLQ_URL=$(aws --endpoint-url=http://localhost:4566 sqs get-queue-url --queue-name inventory-dead-letter-queue --output text --query QueueUrl)
NOTIFICATION_DLQ_URL=$(aws --endpoint-url=http://localhost:4566 sqs get-queue-url --queue-name notification-dead-letter-queue --output text --query QueueUrl)

echo "Orders DLQ URL: $ORDERS_DLQ_URL"
echo "Inventory DLQ URL: $INVENTORY_DLQ_URL"
echo "Notification DLQ URL: $NOTIFICATION_DLQ_URL"

aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes --queue-url "$ORDERS_DLQ_URL" --attributes "{\"RedrivePolicy\":\"{\\\"maxReceiveCount\\\":\\\"5\\\", \\\"deadLetterTargetArn\\\":\\\"$ORDERS_DLQ_URL\\\"}\"}"
aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes --queue-url "$INVENTORY_DLQ_URL" --attributes "{\"RedrivePolicy\":\"{\\\"maxReceiveCount\\\":\\\"5\\\", \\\"deadLetterTargetArn\\\":\\\"$INVENTORY_DLQ_URL\\\"}\"}"
aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes --queue-url "$NOTIFICATION_DLQ_URL" --attributes "{\"RedrivePolicy\":\"{\\\"maxReceiveCount\\\":\\\"5\\\", \\\"deadLetterTargetArn\\\":\\\"$NOTIFICATION_DLQ_URL\\\"}\"}"

# Wait for all SQS queue creation to finish
wait


ORDER_SOURCE="com.order.service"
INVENTORY_SOURCE="com.inventory.service"
NOTIFICATION_SOURCE="com.notification.service"

# Create the EventBridge rules concurrently
aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_placed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_placed\"]
    }" \
    --description "Capture OrderPlaced events" --region "${REGION}" &


aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_updated" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_updated\"]
    }" \
    --description "Capture OrderUpdated events" --region "${REGION}" &


aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_processing" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_processing\"]
    }" \
    --description "Capture order_processing events" --region "${REGION}" &


aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_cancelled_by_user" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_cancelled_by_user\"]
    }" \
    --description "Capture OrderCancelledByUser events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_cancelled_insufficient_inventory" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_cancelled_insufficient_inventory\"]
    }" \
    --description "Capture OrderCancelledInsufficientInventory events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_cancelled_insufficient_funds" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_cancelled_insufficient_funds\"]
    }" \
    --description "Capture OrderCancelledInsufficientFunds events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_processed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_processed\"]
    }" \
    --description "Capture OrderProcessed events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "order_completed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${ORDER_SOURCE}\"],
      \"detail-type\": [\"order_completed\"]
    }" \
    --description "Capture OrderCompleted events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_created" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_created\"]
    }" \
    --description "Capture InventoryCreated events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_updated" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_updated\"]
    }" \
    --description "Capture InventoryUpdated events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_deleted" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_deleted\"]
    }" \
    --description "Capture InventoryDeleted events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_reserved" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_reserved\"]
    }" \
    --description "Capture InventoryReserved events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "inventory_reservation_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${INVENTORY_SOURCE}\"],
      \"detail-type\": [\"inventory_reservation_failed\"]
    }" \
    --description "Capture InventoryReservationFailed events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "notification_sent_success" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${NOTIFICATION_SOURCE}\"],
      \"detail-type\": [\"notification_sent_success\"]
    }" \
    --description "Capture notification_sent_success events" --region "${REGION}" &

aws --endpoint-url=http://localhost:4566 events put-rule \
    --name "notification_sent_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --event-pattern "{
      \"source\": [\"${NOTIFICATION_SOURCE}\"],
      \"detail-type\": [\"notification_sent_failed\"]
    }" \
    --description "Capture notification_sent_failed events" --region "${REGION}" &

# Wait for all rule creation to finish
wait

# Add targets to the rules concurrently
TARGET_NOTIFICATION_ARN="arn:aws:sqs:${REGION}:000000000000:notification-queue"
TARGET_ORDERS_ARN="arn:aws:sqs:${REGION}:000000000000:orders-queue"
TARGET_INVENTORY_ARN="arn:aws:sqs:${REGION}:000000000000:inventory-queue"

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_placed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}" "Id"="2","Arn"="${TARGET_INVENTORY_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_processing" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_cancelled_by_user" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_cancelled_insufficient_inventory" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_cancelled_insufficient_funds" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_processed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "order_completed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_created" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_updated" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_deleted" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_INVENTORY_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_reserved" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}" "Id"="2","Arn"="${TARGET_NOTIFICATION_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "inventory_reservation_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "notification_sent_success" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}" &

aws --endpoint-url=http://localhost:4566 events put-targets \
    --rule "notification_sent_failed" \
    --event-bus-name "${EVENT_BUS_NAME}" \
    --targets "Id"="1","Arn"="${TARGET_ORDERS_ARN}" &

# Wait for all target additions to finish
wait