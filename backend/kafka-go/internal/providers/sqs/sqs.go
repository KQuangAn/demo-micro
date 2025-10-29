package sqs

import (
	"context"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

// Options holds configuration for SQS connection
type Options struct {
	QueueURL string `validate:"required"`
	Region   string `validate:"required"`
}

// Connection represents an SQS connection
type Connection struct {
	client   *sqs.Client
	queueURL string
}

// NewConnection creates a new SQS connection instance
func NewConnection() *Connection {
	return &Connection{}
}

// Connect initializes the SQS client
func (c *Connection) Connect(ctx context.Context, args interface{}) error {
	opts, ok := args.(Options)
	if !ok {
		return fmt.Errorf("invalid options for SQS: expected sqs.Options, got %T", args)
	}

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(opts.Region))
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	c.client = sqs.NewFromConfig(cfg)
	c.queueURL = opts.QueueURL

	log.Printf("SQS connection established: QueueURL=%s, Region=%s", opts.QueueURL, opts.Region)
	return nil
}

// Publish sends messages to SQS queue
func (c *Connection) Publish(ctx context.Context, msgs []string) error {
	if c.client == nil {
		return fmt.Errorf("sqs client not initialized")
	}

	for _, msg := range msgs {
		_, err := c.client.SendMessage(ctx, &sqs.SendMessageInput{
			QueueUrl:    aws.String(c.queueURL),
			MessageBody: aws.String(msg),
		})
		if err != nil {
			return fmt.Errorf("failed to send message: %w", err)
		}
	}

	log.Printf("Published %d messages to SQS queue: %s", len(msgs), c.queueURL)
	return nil
}

// Subscribe receives and processes messages from SQS queue
func (c *Connection) Subscribe(ctx context.Context) error {
	if c.client == nil {
		return fmt.Errorf("sqs client not initialized")
	}

	log.Printf("Subscribing to SQS queue: %s", c.queueURL)

	for {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, stopping subscription")
			return ctx.Err()
		default:
		}

		// Receive messages with long polling
		result, err := c.client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl:            aws.String(c.queueURL),
			MaxNumberOfMessages: 10,
			WaitTimeSeconds:     20, // Long polling (20 seconds)
			VisibilityTimeout:   30,
		})

		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("failed to receive messages: %w", err)
		}

		// Process received messages
		for _, message := range result.Messages {
			log.Printf("Received SQS message: MessageId=%s, Body=%s",
				*message.MessageId, *message.Body)

			// Delete message after processing (acknowledge)
			if err := c.deleteMessage(ctx, message); err != nil {
				log.Printf("Failed to delete message: %v", err)
			}
		}
	}
}

// deleteMessage deletes a message from the queue after processing
func (c *Connection) deleteMessage(ctx context.Context, message types.Message) error {
	_, err := c.client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(c.queueURL),
		ReceiptHandle: message.ReceiptHandle,
	})
	if err != nil {
		return fmt.Errorf("failed to delete message: %w", err)
	}
	return nil
}

// Close closes the SQS connection (no-op for SQS)
func (c *Connection) Close() error {
	// SQS client does not require explicit close
	log.Println("SQS connection closed")
	return nil
}
