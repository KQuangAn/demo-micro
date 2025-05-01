#!/bin/bash
set -euo pipefail

export AWS_REGION="ap-southeast-1"
export AWS_DEFAULT_REGION="ap-southeast-1"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_ENDPOINT_URL="http://localhost:4566"

EVENT_BUS_NAME="evbus"
REGION="$AWS_REGION"

# Wait for LocalStack to be ready
until curl --silent --head --fail "$AWS_ENDPOINT_URL/_localstack/health" >/dev/null; do
  printf '.'
  sleep 5
done
echo "LocalStack is ready."

# Create EventBridge Event Bus if it doesn't exist
if ! aws --endpoint-url="$AWS_ENDPOINT_URL" events list-event-buses | grep -q "$EVENT_BUS_NAME"; then
  echo "Creating event bus $EVENT_BUS_NAME..."
  aws --endpoint-url="$AWS_ENDPOINT_URL" events create-event-bus --name "$EVENT_BUS_NAME" &
else
  echo "Event bus $EVENT_BUS_NAME already exists."
fi

# Create SQS Queues
for queue in orders notification inventory; do
  aws --endpoint-url="$AWS_ENDPOINT_URL" sqs create-queue --queue-name "${queue}-queue" &
  aws --endpoint-url="$AWS_ENDPOINT_URL" sqs create-queue --queue-name "${queue}-dead-letter-queue" &
done
wait

# Get main and DLQ URLs
ORDERS_QUEUE_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name orders-queue --query QueueUrl --output text)
INVENTORY_QUEUE_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name inventory-queue --query QueueUrl --output text)
NOTIFICATION_QUEUE_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name notification-queue --query QueueUrl --output text)

ORDERS_DLQ_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name orders-dead-letter-queue --query QueueUrl --output text)
INVENTORY_DLQ_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name inventory-dead-letter-queue --query QueueUrl --output text)
NOTIFICATION_DLQ_URL=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-url --queue-name notification-dead-letter-queue --query QueueUrl --output text)

# Get DLQ ARNs
ORDERS_DLQ_ARN=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-attributes --queue-url "$ORDERS_DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
INVENTORY_DLQ_ARN=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-attributes --queue-url "$INVENTORY_DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
NOTIFICATION_DLQ_ARN=$(aws --endpoint-url="$AWS_ENDPOINT_URL" sqs get-queue-attributes --queue-url "$NOTIFICATION_DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)

# Set Redrive Policies
for queue_url in "$ORDERS_QUEUE_URL" "$INVENTORY_QUEUE_URL" "$NOTIFICATION_QUEUE_URL"; do
  case $queue_url in
    *orders*) DLQ_ARN=$ORDERS_DLQ_ARN ;;
    *inventory*) DLQ_ARN=$INVENTORY_DLQ_ARN ;;
    *notification*) DLQ_ARN=$NOTIFICATION_DLQ_ARN ;;
  esac

  aws --endpoint-url="$AWS_ENDPOINT_URL" sqs set-queue-attributes \
    --queue-url "$queue_url" \
    --attributes "{\"RedrivePolicy\":\"{\\\"maxReceiveCount\\\":\\\"5\\\",\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\"}\"}" &
done
wait

# EventBridge rule definitions
declare -A RULES=(
  ["order_placed"]="com.order.service:order_placed"
  ["order_updated"]="com.order.service:order_updated"
  ["order_processing"]="com.order.service:order_processing"
  ["order_cancelled_by_user"]="com.order.service:order_cancelled_by_user"
  ["order_cancelled_insufficient_inventory"]="com.order.service:order_cancelled_insufficient_inventory"
  ["order_cancelled_insufficient_funds"]="com.order.service:order_cancelled_insufficient_funds"
  ["order_processed"]="com.order.service:order_processed"
  ["order_completed"]="com.order.service:order_completed"
  ["inventory_created"]="com.inventory.service:inventory_created"
  ["inventory_updated"]="com.inventory.service:inventory_updated"
  ["inventory_deleted"]="com.inventory.service:inventory_deleted"
  ["inventory_reserved"]="com.inventory.service:inventory_reserved"
  ["inventory_reservation_failed"]="com.inventory.service:inventory_reservation_failed"
  ["notification_sent_success"]="com.notification.service:notification_sent_success"
  ["notification_sent_failed"]="com.notification.service:notification_sent_failed"
)

for rule in "${!RULES[@]}"; do
  IFS=":" read -r SOURCE TYPE <<<"${RULES[$rule]}"
  aws --endpoint-url="$AWS_ENDPOINT_URL" events put-rule \
    --name "$rule" \
    --event-bus-name "$EVENT_BUS_NAME" \
    --event-pattern "{\"source\": [\"$SOURCE\"], \"detail-type\": [\"$TYPE\"]}" \
    --description "Capture ${TYPE//_/ } events" \
    --region "$REGION" &
done
wait

# Define targets
TARGET_ORDERS_ARN="arn:aws:sqs:${REGION}:000000000000:orders-queue"
TARGET_NOTIFICATION_ARN="arn:aws:sqs:${REGION}:000000000000:notification-queue"
TARGET_INVENTORY_ARN="arn:aws:sqs:${REGION}:000000000000:inventory-queue"

# Helper to add multiple targets
put_targets() {
  local rule=$1
  shift
  local targets=()
  local i=1
  for arn in "$@"; do
    targets+=("{\"Id\":\"$i\",\"Arn\":\"$arn\"}")
    ((i++))
  done
  aws --endpoint-url="$AWS_ENDPOINT_URL" events put-targets \
    --rule "$rule" \
    --event-bus-name "$EVENT_BUS_NAME" \
    --targets "$(IFS=, ; echo "${targets[*]}")" &
}

# Map rules to targets
put_targets "order_placed" "$TARGET_NOTIFICATION_ARN" "$TARGET_INVENTORY_ARN"
put_targets "order_processing" "$TARGET_INVENTORY_ARN" "$TARGET_NOTIFICATION_ARN"
put_targets "order_cancelled_by_user" "$TARGET_INVENTORY_ARN" "$TARGET_NOTIFICATION_ARN"
put_targets "order_cancelled_insufficient_inventory" "$TARGET_INVENTORY_ARN" "$TARGET_NOTIFICATION_ARN"
put_targets "order_cancelled_insufficient_funds" "$TARGET_INVENTORY_ARN" "$TARGET_NOTIFICATION_ARN"
put_targets "order_processed" "$TARGET_NOTIFICATION_ARN"
put_targets "order_completed" "$TARGET_NOTIFICATION_ARN"
put_targets "inventory_created" "$TARGET_INVENTORY_ARN"
put_targets "inventory_updated" "$TARGET_INVENTORY_ARN"
put_targets "inventory_deleted" "$TARGET_INVENTORY_ARN"
put_targets "inventory_reserved" "$TARGET_ORDERS_ARN" "$TARGET_NOTIFICATION_ARN"
put_targets "inventory_reservation_failed" "$TARGET_ORDERS_ARN"
put_targets "notification_sent_success" "$TARGET_ORDERS_ARN"
put_targets "notification_sent_failed" "$TARGET_ORDERS_ARN"

wait
echo "✅ LocalStack EventBridge and SQS setup completed."
