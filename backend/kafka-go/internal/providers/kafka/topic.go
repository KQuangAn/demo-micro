package kafka

import (
	"context"
	"fmt"
	"log"

	kafka "github.com/segmentio/kafka-go"
)

// TopicConfig holds configuration for creating a topic
type TopicConfig struct {
	Topic             string
	NumPartitions     int
	ReplicationFactor int
}

// CreateTopic creates a new Kafka topic if it doesn't exist
func CreateTopic(ctx context.Context, brokers []string, config TopicConfig) error {
	// Try to connect to each broker until we find the controller or succeed
	var lastErr error

	for _, broker := range brokers {
		conn, err := kafka.DialContext(ctx, "tcp", broker)
		if err != nil {
			lastErr = fmt.Errorf("failed to connect to broker %s: %w", broker, err)
			continue
		}

		// Check if topic already exists
		partitions, err := conn.ReadPartitions()
		if err != nil {
			conn.Close()
			lastErr = fmt.Errorf("failed to read partitions from %s: %w", broker, err)
			continue
		}

		topicExists := false
		for _, p := range partitions {
			if p.Topic == config.Topic {
				topicExists = true
				log.Printf("Topic '%s' already exists", config.Topic)
				conn.Close()
				return nil
			}
		}

		if topicExists {
			conn.Close()
			return nil
		}

		// Create topic
		topicConfigs := []kafka.TopicConfig{
			{
				Topic:             config.Topic,
				NumPartitions:     config.NumPartitions,
				ReplicationFactor: config.ReplicationFactor,
			},
		}

		err = conn.CreateTopics(topicConfigs...)
		conn.Close()

		if err != nil {
			// If it's a "Not Controller" error, try next broker
			if isNotControllerError(err) {
				log.Printf("Broker %s is not the controller, trying next broker...", broker)
				lastErr = err
				continue
			}
			// For other errors, return immediately
			return fmt.Errorf("failed to create topic on %s: %w", broker, err)
		}

		log.Printf("Topic '%s' created successfully (partitions=%d, replication=%d)",
			config.Topic, config.NumPartitions, config.ReplicationFactor)
		return nil
	}

	// If we've tried all brokers and failed
	if lastErr != nil {
		return fmt.Errorf("failed to create topic after trying all brokers: %w", lastErr)
	}
	return fmt.Errorf("failed to create topic: no brokers available")
}

// isNotControllerError checks if the error is a "Not Controller" error
func isNotControllerError(err error) bool {
	return err != nil && (err.Error() == "[41] Not Controller: this is not the correct controller for this cluster" ||
		err.Error() == "Not Controller")
}

// ListTopics lists all available topics in the Kafka cluster
func ListTopics(ctx context.Context, brokers []string) ([]string, error) {
	conn, err := kafka.DialContext(ctx, "tcp", brokers[0])
	if err != nil {
		return nil, fmt.Errorf("failed to connect to broker: %w", err)
	}
	defer conn.Close()

	partitions, err := conn.ReadPartitions()
	if err != nil {
		return nil, fmt.Errorf("failed to read partitions: %w", err)
	}

	// Use map to get unique topics
	topicSet := make(map[string]bool)
	for _, p := range partitions {
		topicSet[p.Topic] = true
	}

	topics := make([]string, 0, len(topicSet))
	for topic := range topicSet {
		topics = append(topics, topic)
	}

	return topics, nil
}

// DeleteTopic deletes a Kafka topic
func DeleteTopic(ctx context.Context, brokers []string, topic string) error {
	var lastErr error

	for _, broker := range brokers {
		conn, err := kafka.DialContext(ctx, "tcp", broker)
		if err != nil {
			lastErr = fmt.Errorf("failed to connect to broker %s: %w", broker, err)
			continue
		}

		err = conn.DeleteTopics(topic)
		conn.Close()

		if err != nil {
			// If it's a "Not Controller" error, try next broker
			if isNotControllerError(err) {
				log.Printf("Broker %s is not the controller, trying next broker...", broker)
				lastErr = err
				continue
			}
			return fmt.Errorf("failed to delete topic on %s: %w", broker, err)
		}

		log.Printf("Topic '%s' deleted successfully", topic)
		return nil
	}

	if lastErr != nil {
		return fmt.Errorf("failed to delete topic after trying all brokers: %w", lastErr)
	}
	return fmt.Errorf("failed to delete topic: no brokers available")
}
