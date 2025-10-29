package queue

import (
	"context"
	"fmt"
	"sync"

	"github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
	"github.com/demo-micro/backend/kafka-go/internal/providers/sqs"
	validator "github.com/go-playground/validator/v10"
)

// Factory creates Queue instances based on provider type
type Factory struct {
	validator *validator.Validate
	once      sync.Once
}

// NewFactory creates a new factory instance
func NewFactory() *Factory {
	return &Factory{
		validator: validator.New(),
	}
}

// CreateConnection creates and returns a Queue based on the provider type
func (f *Factory) CreateConnection(ctx context.Context, providerType ProviderType, options interface{}) (Queue, error) {
	// Lazy initialization of validator
	f.once.Do(func() {
		if f.validator == nil {
			f.validator = validator.New()
		}
	})

	switch providerType {
	case ProviderKafka:
		return f.createKafkaConnection(ctx, options)
	case ProviderSQS:
		return f.createSQSConnection(ctx, options)
	default:
		return nil, fmt.Errorf("unsupported queue provider: %s", providerType)
	}
}

// createKafkaConnection creates a Kafka connection
func (f *Factory) createKafkaConnection(ctx context.Context, options interface{}) (Queue, error) {
	kafkaOpts, ok := options.(kafka.Options)
	if !ok {
		return nil, fmt.Errorf("invalid options type for Kafka: expected kafka.Options, got %T", options)
	}

	// Validate options
	if err := f.validator.Struct(kafkaOpts); err != nil {
		return nil, fmt.Errorf("kafka options validation failed: %w", err)
	}

	conn := kafka.NewConnection()

	if err := conn.Connect(ctx, kafkaOpts); err != nil {
		return nil, fmt.Errorf("failed to connect to Kafka: %w", err)
	}

	return conn, nil
}

// createSQSConnection creates an SQS connection
func (f *Factory) createSQSConnection(ctx context.Context, options interface{}) (Queue, error) {
	sqsOpts, ok := options.(sqs.Options)
	if !ok {
		return nil, fmt.Errorf("invalid options type for SQS: expected sqs.Options, got %T", options)
	}

	// Validate options
	if err := f.validator.Struct(sqsOpts); err != nil {
		return nil, fmt.Errorf("sqs options validation failed: %w", err)
	}

	conn := sqs.NewConnection()

	if err := conn.Connect(ctx, sqsOpts); err != nil {
		return nil, fmt.Errorf("failed to connect to SQS: %w", err)
	}

	return conn, nil
}

// GetSupportedProviders returns a list of supported provider types
func (f *Factory) GetSupportedProviders() []ProviderType {
	return []ProviderType{ProviderKafka, ProviderSQS}
}
