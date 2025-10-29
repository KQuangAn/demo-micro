package queue

import "context"

// Queue defines the interface for message queue operations
type Queue interface {
	Connect(ctx context.Context, args interface{}) error
	Publish(ctx context.Context, msgs []string) error
	Subscribe(ctx context.Context) error
	Close() error
}

// ProviderType represents the type of message queue provider
type ProviderType string

const (
	ProviderKafka ProviderType = "kafka"
	ProviderSQS   ProviderType = "sqs"
)
