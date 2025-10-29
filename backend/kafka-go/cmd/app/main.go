package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
	"github.com/demo-micro/backend/kafka-go/pkg/queue"
)

var (
	// BootstrapServers default Kafka broker addresses
	BootstrapServers = []string{"localhost:9092", "localhost:9093", "localhost:9094"}
)

const (
	// Environment variable keys
	envTopic     = "TOPIC"
	envGroupID   = "GROUP_ID"
	envDelayMs   = "DELAY_MS"
	envPartition = "PARTITION"
)

// getEnv retrieves environment variable or returns default value
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func main() {
	// Create context with cancellation for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle OS signals for graceful shutdown
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-signals
		log.Printf("Received signal: %v", sig)
		cancel()
	}()

	// Get configuration from environment
	topic := getEnv(envTopic, "my-topic")
	groupID := getEnv(envGroupID, "my-group")

	// Create topic if it doesn't exist
	log.Println("Ensuring topic exists...")
	err := kafka.CreateTopic(ctx, BootstrapServers, kafka.TopicConfig{
		Topic:             topic,
		NumPartitions:     3,
		ReplicationFactor: 3,
	})
	if err != nil {
		log.Fatalf("Failed to create topic: %v", err)
	}

	// Create queue factory
	factory := queue.NewFactory()

	// Configure Kafka options
	kafkaOpts := kafka.Options{
		Brokers: BootstrapServers,
		Topic:   topic,
		GroupID: groupID,
	}

	// Create Kafka connection
	eventQueue, err := factory.CreateConnection(ctx, queue.ProviderKafka, kafkaOpts)
	if err != nil {
		log.Fatalf("Failed to create connection: %v", err)
	}
	defer func() {
		if err := eventQueue.Close(); err != nil {
			log.Printf("Error closing connection: %v", err)
		}
	}()

	// Publish messages with timeout
	publishCtx, publishCancel := context.WithTimeout(ctx, 10*time.Second)
	defer publishCancel()

	messages := []string{"Hello from refactored app!", "Message 2", "Message 3"}
	if err := eventQueue.Publish(publishCtx, messages); err != nil {
		log.Printf("Failed to publish messages: %v", err)
	}

	// Subscribe to messages in a goroutine
	go func() {
		if err := eventQueue.Subscribe(ctx); err != nil {
			if err != context.Canceled {
				log.Printf("Subscription error: %v", err)
			}
		}
	}()

	// Wait for cancellation signal
	<-ctx.Done()
	log.Println("Shutting down gracefully...")

	// Allow time for cleanup
	time.Sleep(2 * time.Second)
	log.Println("Application stopped")
}
