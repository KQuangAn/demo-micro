package kafka

import (
	"context"
	"fmt"
	"log"

	kafka "github.com/segmentio/kafka-go"
)

// BrokerMetadata holds information about a broker
type BrokerMetadata struct {
	ID   int
	Host string
	Port int
	Rack string
}

// PartitionMetadata holds information about a partition
type PartitionMetadata struct {
	Topic       string
	PartitionID int
	Leader      BrokerMetadata
	Replicas    []BrokerMetadata
	ISR         []BrokerMetadata // In-Sync Replicas
}

// ClusterMetadata holds information about the Kafka cluster
type ClusterMetadata struct {
	Brokers    []BrokerMetadata
	Controller BrokerMetadata
	Topics     map[string][]PartitionMetadata
}

// GetClusterMetadata retrieves comprehensive metadata about the Kafka cluster
func GetClusterMetadata(ctx context.Context, brokers []string) (*ClusterMetadata, error) {
	var conn *kafka.Conn
	var err error

	// Try to connect to any broker
	for _, broker := range brokers {
		conn, err = kafka.DialContext(ctx, "tcp", broker)
		if err == nil {
			break
		}
	}
	if conn == nil {
		return nil, fmt.Errorf("failed to connect to any broker: %w", err)
	}
	defer conn.Close()

	// Get broker list
	brokerList, err := conn.Brokers()
	if err != nil {
		return nil, fmt.Errorf("failed to get brokers: %w", err)
	}

	metadata := &ClusterMetadata{
		Brokers: make([]BrokerMetadata, 0),
		Topics:  make(map[string][]PartitionMetadata),
	}

	// Convert broker list
	for _, b := range brokerList {
		metadata.Brokers = append(metadata.Brokers, BrokerMetadata{
			ID:   b.ID,
			Host: b.Host,
			Port: b.Port,
			Rack: b.Rack,
		})
	}

	// Get controller
	controller, err := conn.Controller()
	if err != nil {
		log.Printf("Warning: failed to get controller: %v", err)
	} else {
		metadata.Controller = BrokerMetadata{
			ID:   controller.ID,
			Host: controller.Host,
			Port: controller.Port,
			Rack: controller.Rack,
		}
	}

	// Get partition metadata
	partitions, err := conn.ReadPartitions()
	if err != nil {
		return nil, fmt.Errorf("failed to read partitions: %w", err)
	}

	for _, p := range partitions {
		leaderBroker := BrokerMetadata{
			ID: p.Leader.ID,
		}

		replicas := make([]BrokerMetadata, len(p.Replicas))
		for i, r := range p.Replicas {
			replicas[i] = BrokerMetadata{ID: r.ID}
		}

		isr := make([]BrokerMetadata, len(p.Isr))
		for i, r := range p.Isr {
			isr[i] = BrokerMetadata{ID: r.ID}
		}

		partMeta := PartitionMetadata{
			Topic:       p.Topic,
			PartitionID: p.ID,
			Leader:      leaderBroker,
			Replicas:    replicas,
			ISR:         isr,
		}

		metadata.Topics[p.Topic] = append(metadata.Topics[p.Topic], partMeta)
	}

	return metadata, nil
}

// GetPartitionLeader gets the leader broker for a specific partition
func GetPartitionLeader(ctx context.Context, brokers []string, topic string, partition int) (*BrokerMetadata, error) {
	metadata, err := GetClusterMetadata(ctx, brokers)
	if err != nil {
		return nil, err
	}

	partitions, ok := metadata.Topics[topic]
	if !ok {
		return nil, fmt.Errorf("topic '%s' not found", topic)
	}

	for _, p := range partitions {
		if p.PartitionID == partition {
			return &p.Leader, nil
		}
	}

	return nil, fmt.Errorf("partition %d not found for topic '%s'", partition, topic)
}

// GetController returns the controller broker
func GetController(ctx context.Context, brokers []string) (*BrokerMetadata, error) {
	var conn *kafka.Conn
	var err error

	for _, broker := range brokers {
		conn, err = kafka.DialContext(ctx, "tcp", broker)
		if err == nil {
			defer conn.Close()
			break
		}
	}
	if conn == nil {
		return nil, fmt.Errorf("failed to connect to any broker")
	}

	controller, err := conn.Controller()
	if err != nil {
		return nil, fmt.Errorf("failed to get controller: %w", err)
	}

	return &BrokerMetadata{
		ID:   controller.ID,
		Host: controller.Host,
		Port: controller.Port,
		Rack: controller.Rack,
	}, nil
}

// PrintClusterMetadata prints cluster metadata in a readable format
func PrintClusterMetadata(metadata *ClusterMetadata) {
	fmt.Println("\n📊 Kafka Cluster Metadata")
	fmt.Println("=" + "=============================================")

	// Print brokers
	fmt.Printf("\n🖥️  Brokers (%d):\n", len(metadata.Brokers))
	for _, b := range metadata.Brokers {
		fmt.Printf("  - Broker %d: %s:%d", b.ID, b.Host, b.Port)
		if b.ID == metadata.Controller.ID {
			fmt.Printf(" [CONTROLLER]")
		}
		fmt.Println()
	}

	// Print controller
	fmt.Printf("\n👑 Controller: Broker %d (%s:%d)\n",
		metadata.Controller.ID, metadata.Controller.Host, metadata.Controller.Port)

	// Print topics and partitions
	fmt.Printf("\n📋 Topics (%d):\n", len(metadata.Topics))
	for topic, partitions := range metadata.Topics {
		fmt.Printf("\n  📌 Topic: %s (%d partitions)\n", topic, len(partitions))
		for _, p := range partitions {
			fmt.Printf("     Partition %d → Leader: Broker %d | Replicas: %v | ISR: %v\n",
				p.PartitionID,
				p.Leader.ID,
				getBrokerIDs(p.Replicas),
				getBrokerIDs(p.ISR))
		}
	}
	fmt.Println()
}

func getBrokerIDs(brokers []BrokerMetadata) []int {
	ids := make([]int, len(brokers))
	for i, b := range brokers {
		ids[i] = b.ID
	}
	return ids
}
