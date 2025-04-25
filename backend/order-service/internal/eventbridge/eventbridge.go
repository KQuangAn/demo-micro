package eventbridge

import (
	"context"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	eb "github.com/aws/aws-sdk-go-v2/service/eventbridge"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

type EventBridgeClient interface {
	PutEvents(ctx context.Context, params *eb.PutEventsInput, optFns ...func(*eb.Options)) (*eb.PutEventsOutput, error)
}

var client EventBridgeClient

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithEndpointResolver(aws.EndpointResolverFunc(
		func(service, region string) (aws.Endpoint, error) {
			if service == eb.ServiceID && region == "ap-southeast-1" {
				return aws.Endpoint{
					URL: "http://eventbridge.ap-southeast-1.localhost.localstack.cloud:4566",
				}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		},
	)))

	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	client = eb.NewFromConfig(cfg)
}

func SendEvent(ev *ebTypes.PutEventsRequestEntry) error {
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
