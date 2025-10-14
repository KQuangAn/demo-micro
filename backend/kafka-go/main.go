// package main

// import (
// 	"context"
// 	"fmt"
// 	"os"
// 	"os/signal"
// 	"strings"
// 	"syscall"
// 	"time"

// 	kafka "github.com/segmentio/kafka-go"
// )

// const (
// 	// BootstrapServers : bootstrap servers list
// 	BootstrapServers string = "BOOTSTRAP_SERVERS"
// 	// Topic : topic
// 	Topic string = "TOPIC"
// 	// GroupID : consumer group
// 	GroupID string = "GROUP_ID"
// 	// DelayMs : between sent messages
// 	DelayMs string = "DELAY_MS"
// 	// Partition : partition from which to consume
// 	Partition string = "PARTITION"
// )

// func GetEnv(key, defaultValue string) string {
// 	value, exists := os.LookupEnv(key)
// 	if exists {
// 		return value
// 	}
// 	return defaultValue
// }

// func main() {
// 	signals := make(chan os.Signal, 1)
// 	signal.Notify(signals, syscall.SIGINT, syscall.SIGKILL)

// 	ctx, cancel := context.WithCancel(context.Background())

// 	go func() {
// 		sig := <-signals
// 		fmt.Println("Got signal: ", sig)
// 		cancel()
// 	}()

// 	bootstrapServers := strings.Split(GetEnv(BootstrapServers, "localhost:9092"), ",")
// 	topic := GetEnv(Topic, "my-topic")
// 	groupID := GetEnv(GroupID, "my-group")

// 	config := kafka.ReaderConfig{
// 		Brokers:  bootstrapServers,
// 		GroupID:  groupID,
// 		Topic:    topic,
// 		MaxWait:  500 * time.Millisecond,
// 		MinBytes: 1}

// 	r := kafka.NewReader(config)

// 	defer func() {
// 		err := r.Close()
// 		if err != nil {
// 			fmt.Println("Error closing consumer: ", err)
// 			return
// 		}
// 		fmt.Println("Consumer closed")
// 	}()

// 	for {
// 		m, err := r.ReadMessage(ctx)
// 		if err != nil {
// 			fmt.Println("Error reading message: ", err)
// 			break
// 		}
// 		fmt.Printf("Received message from %s-%d [%d]: %s = %s\n", m.Topic, m.Partition, m.Offset, string(m.Key), string(m.Value))
// 	}

// 	factory := &EventQueueFactory{}

// 	eventQueue, err := factory.CreateConnection("kafka", config)
// 	if err != nil {
// 		fmt.Println("Error creating Kafka strategy:", err)
// 		return
// 	}

// 	if err := eventQueue.Connect(nil); err != nil {
// 		fmt.Println("Error connecting to Kafka:", err)
// 		return
// 	}
// 	eventQueue.Publish("Hello, Kafka!")
// 	eventQueue.Subscribe("my-topic")
// 	eventQueue.Close()

// }
