package eventemitter

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

type EventBridgeEmitter struct {
	client *eventbridge.Client
}

func NewEventBridgeEmitter(cfg aws.Config) *EventBridgeEmitter {
	return &EventBridgeEmitter{
		client: eventbridge.NewFromConfig(cfg),
	}
}

func (e *EventBridgeEmitter) Emit(ctx context.Context, ev *Event) error {
	entry := types.PutEventsRequestEntry{
		Source:       ev.Source,
		DetailType:   ev.DetailType,
		Detail:       ev.Detail,
		EventBusName: ev.EventBusName,
		TraceHeader:  ev.TraceHeader,
	}

	input := &eventbridge.PutEventsInput{
		Entries: []types.PutEventsRequestEntry{entry},
	}

	_, err := e.client.PutEvents(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to send event to EventBridge: %w", err)
	}
	return nil
}
