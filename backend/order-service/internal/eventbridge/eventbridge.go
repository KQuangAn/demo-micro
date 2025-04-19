package eventbridge

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	eb "github.com/aws/aws-sdk-go-v2/service/eventbridge"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

// EventBridgeClient interface allows mocking in tests
type EventBridgeClient interface {
    PutEvents(ctx context.Context, params *eb.PutEventsInput, optFns ...func(*eb.Options)) (*eb.PutEventsOutput, error)
}

// Default client for EventBridge
var client EventBridgeClient = eb.NewFromConfig(aws.Config{})

// NotificationEvent represents the data to send to EventBridge for notifications
type NotificationEvent struct {
	OrderID string `json:"orderId"`
	Status  string `json:"status"`
}

// SendEventToNotificationService sends a notification event to EventBridge
func SendEventToNotificationService(notificationEvent NotificationEvent) error {
	// Marshal the event data to JSON
	eventDetail, err := json.Marshal(notificationEvent)
	if err != nil {
		return fmt.Errorf("failed to marshal event detail: %v", err)
	}

	// Create the event entry to be sent to EventBridge
	eventEntry := ebTypes.PutEventsRequestEntry{
		Source:        aws.String("orderService"), // Identify the source of the event
		DetailType:    aws.String("OrderStatusUpdate"),
		Detail:        aws.String(string(eventDetail)), // The event payload (order status)
		EventBusName:  aws.String("OrderEventBus"),     // The name of your EventBridge event bus
	}

	// Create the input for the PutEvents method
	putEventsInput := &eb.PutEventsInput{
		Entries: []ebTypes.PutEventsRequestEntry{eventEntry},
	}

	// Put the event to EventBridge
	_, err = client.PutEvents(context.Background(), putEventsInput)
	if err != nil {
		return fmt.Errorf("failed to send event to EventBridge: %v", err)
	}

	return nil
}
