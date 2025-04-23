EVENT_BUS_NAME="evbus"
RULE_NAME="order_placed"  # Change this to your target rule name

# Get all target IDs, trim whitespace, and delete them
aws --endpoint-url=http://localhost:4566 events list-targets-by-rule --rule "$RULE_NAME" --event-bus-name "$EVENT_BUS_NAME" --query 'Targets[*].Id' --output text | tr '\n' ' ' | sed 's/[[:space:]]//g' | xargs -n 1 aws --endpoint-url=http://localhost:4566 events remove-targets --rule "$RULE_NAME" --event-bus-name "$EVENT_BUS_NAME" --ids