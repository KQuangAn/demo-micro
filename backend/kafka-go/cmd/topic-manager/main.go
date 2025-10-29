package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"

	"github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
)

var (
	defaultBrokers = []string{"localhost:9092", "localhost:9093", "localhost:9094"}
)

func main() {
	// Define command-line flags
	brokersFlag := flag.String("brokers", "localhost:9092,localhost:9093,localhost:9094", "Comma-separated list of Kafka brokers")
	action := flag.String("action", "list", "Action to perform: create, list, delete")
	topic := flag.String("topic", "", "Topic name (required for create/delete)")
	partitions := flag.Int("partitions", 3, "Number of partitions (for create)")
	replication := flag.Int("replication", 3, "Replication factor (for create)")

	flag.Parse()

	// Parse brokers
	brokers := strings.Split(*brokersFlag, ",")
	for i := range brokers {
		brokers[i] = strings.TrimSpace(brokers[i])
	}

	ctx := context.Background()

	switch *action {
	case "create":
		if *topic == "" {
			log.Fatal("Topic name is required for create action. Use -topic flag")
		}
		err := kafka.CreateTopic(ctx, brokers, kafka.TopicConfig{
			Topic:             *topic,
			NumPartitions:     *partitions,
			ReplicationFactor: *replication,
		})
		if err != nil {
			log.Fatalf("Failed to create topic: %v", err)
		}
		fmt.Printf("✅ Topic '%s' created successfully\n", *topic)

	case "list":
		topics, err := kafka.ListTopics(ctx, brokers)
		if err != nil {
			log.Fatalf("Failed to list topics: %v", err)
		}
		fmt.Println("📋 Available topics:")
		if len(topics) == 0 {
			fmt.Println("  (no topics found)")
		} else {
			for _, t := range topics {
				fmt.Printf("  - %s\n", t)
			}
		}

	case "delete":
		if *topic == "" {
			log.Fatal("Topic name is required for delete action. Use -topic flag")
		}
		err := kafka.DeleteTopic(ctx, brokers, *topic)
		if err != nil {
			log.Fatalf("Failed to delete topic: %v", err)
		}
		fmt.Printf("✅ Topic '%s' deleted successfully\n", *topic)

	default:
		log.Fatalf("Unknown action: %s. Use 'create', 'list', or 'delete'", *action)
	}
}
