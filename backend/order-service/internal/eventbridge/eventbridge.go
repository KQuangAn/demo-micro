package eventbridge

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	eb "github.com/aws/aws-sdk-go-v2/service/eventbridge"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

type EventBridgeClient interface {
	PutEvents(ctx context.Context, params *eb.PutEventsInput, optFns ...func(*eb.Options)) (*eb.PutEventsOutput, error)
}

var client EventBridgeClient = eb.NewFromConfig(aws.Config{})

func SendEvent(ev ebTypes.PutEventsRequestEntry) error {
	eventEntry := ebTypes.PutEventsRequestEntry{
		Source:       aws.String(*ev.Source),
		DetailType:   aws.String(*ev.DetailType),
		Detail:       aws.String(*ev.Detail),
		EventBusName: aws.String(*ev.EventBusName),
	}
	putEventsInput := &eb.PutEventsInput{
		Entries: []ebTypes.PutEventsRequestEntry{eventEntry},
	}

	_, err := client.PutEvents(context.Background(), putEventsInput)
	if err != nil {
		return fmt.Errorf("failed to send event to EventBridge: %v", err)
	}

	return nil
}
