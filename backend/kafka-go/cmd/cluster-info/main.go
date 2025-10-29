package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"

	"github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
)

func main() {
	brokersFlag := flag.String("brokers", "localhost:9092,localhost:9093,localhost:9094", "Comma-separated list of Kafka brokers")
	action := flag.String("action", "all", "Action: all, controller, topic")
	topic := flag.String("topic", "", "Topic name (for topic action)")

	flag.Parse()

	brokers := strings.Split(*brokersFlag, ",")
	for i := range brokers {
		brokers[i] = strings.TrimSpace(brokers[i])
	}

	ctx := context.Background()

	switch *action {
	case "all":
		metadata, err := kafka.GetClusterMetadata(ctx, brokers)
		if err != nil {
			log.Fatalf("Failed to get cluster metadata: %v", err)
		}
		kafka.PrintClusterMetadata(metadata)

	case "controller":
		controller, err := kafka.GetController(ctx, brokers)
		if err != nil {
			log.Fatalf("Failed to get controller: %v", err)
		}
		fmt.Printf("👑 Controller: Broker %d at %s:%d\n", controller.ID, controller.Host, controller.Port)

	case "topic":
		if *topic == "" {
			log.Fatal("Topic name is required for topic action. Use -topic flag")
		}
		metadata, err := kafka.GetClusterMetadata(ctx, brokers)
		if err != nil {
			log.Fatalf("Failed to get cluster metadata: %v", err)
		}

		partitions, ok := metadata.Topics[*topic]
		if !ok {
			log.Fatalf("Topic '%s' not found", *topic)
		}

		fmt.Printf("\n📌 Topic: %s (%d partitions)\n", *topic, len(partitions))
		for _, p := range partitions {
			fmt.Printf("  Partition %d:\n", p.PartitionID)
			fmt.Printf("    Leader:   Broker %d\n", p.Leader.ID)
			fmt.Printf("    Replicas: %v\n", getBrokerIDs(p.Replicas))
			fmt.Printf("    ISR:      %v\n", getBrokerIDs(p.ISR))
		}

	default:
		log.Fatalf("Unknown action: %s. Use 'all', 'controller', or 'topic'", *action)
	}
}

func getBrokerIDs(brokers []kafka.BrokerMetadata) []int {
	ids := make([]int, len(brokers))
	for i, b := range brokers {
		ids[i] = b.ID
	}
	return ids
}
