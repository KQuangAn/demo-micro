package kafka

import (
	"context"
	"fmt"
	"log"

	kafka "github.com/segmentio/kafka-go"
)

// Options holds configuration for Kafka connection
type Options struct {
	Brokers []string `validate:"required"`
	Topic   string   `validate:"required"`
	GroupID string   `validate:"required"`
}

// Connection represents a Kafka connection with reader and writer
type Connection struct {
	writer *kafka.Writer
	reader *kafka.Reader
	topic  string
}

// NewConnection creates a new Kafka connection instance
func NewConnection() *Connection {
	return &Connection{}
}

// Connect initializes both producer (writer) and consumer (reader)
func (c *Connection) Connect(ctx context.Context, args interface{}) error {
	opts, ok := args.(Options)
	if !ok {
		return fmt.Errorf("invalid options for Kafka: expected kafka.Options, got %T", args)
	}

	c.topic = opts.Topic

	// Initialize Writer (Producer)
	c.writer = kafka.NewWriter(kafka.WriterConfig{
		Brokers:      opts.Brokers,
		Topic:        opts.Topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: int(kafka.RequireAll),
		// Compression:  kafka.Snappy,
	})

	// Initialize Reader (Consumer)
	c.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers:  opts.Brokers,
		Topic:    opts.Topic,
		GroupID:  opts.GroupID,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})

	log.Printf("Kafka connection established: Topic=%s, Brokers=%v", opts.Topic, opts.Brokers)
	return nil
}

// Publish sends messages to Kafka (Producer)
func (c *Connection) Publish(ctx context.Context, msgs []string) error {
	if c.writer == nil {
		return fmt.Errorf("kafka writer not initialized")
	}

	var kafkaMessages []kafka.Message
	for _, msg := range msgs {
		kafkaMessages = append(kafkaMessages, kafka.Message{
			Value: []byte(msg),
		})
	}

	err := c.writer.WriteMessages(ctx, kafkaMessages...)
	if err != nil {
		return fmt.Errorf("failed to write messages: %w", err)
	}

	log.Printf("Published %d messages to topic: %s", len(msgs), c.topic)
	return nil
}

// Subscribe reads messages from Kafka (Consumer)
func (c *Connection) Subscribe(ctx context.Context) error {
	if c.reader == nil {
		return fmt.Errorf("kafka reader not initialized")
	}

	log.Printf("Subscribing to topic: %s", c.topic)

	for {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, stopping subscription")
			return ctx.Err()
		default:
		}

		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("failed to read message: %w", err)
		}

		log.Printf("Received message: Key=%s, Value=%s, Partition=%d, Offset=%d",
			string(msg.Key), string(msg.Value), msg.Partition, msg.Offset)

		// Commit the message
		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Printf("Failed to commit message: %v", err)
		}
	}
}

// Close closes both writer and reader connections
func (c *Connection) Close() error {
	var writerErr, readerErr error

	if c.writer != nil {
		writerErr = c.writer.Close()
		if writerErr != nil {
			log.Printf("Error closing Kafka writer: %v", writerErr)
		}
	}

	if c.reader != nil {
		readerErr = c.reader.Close()
		if readerErr != nil {
			log.Printf("Error closing Kafka reader: %v", readerErr)
		}
	}

	if writerErr != nil {
		return writerErr
	}
	return readerErr
}

// CommitOffset manually commits the offset for a message (Kafka-specific)
func (c *Connection) CommitOffset(ctx context.Context, msg kafka.Message) error {
	if c.reader == nil {
		return fmt.Errorf("kafka reader not initialized")
	}
	return c.reader.CommitMessages(ctx, msg)
}
