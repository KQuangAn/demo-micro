package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"

	kafkaGo "github.com/segmentio/kafka-go"
)

const (
	BootstrapServers string = "localhost:9092"
	Topic            string = "my-topic"
	GroupID          string = "GROUP_ID"
)

func newKafkaWriter(url, topic string) *kafkaGo.Writer {
	return &kafkaGo.Writer{
		Addr:     kafkaGo.TCP(url),
		Topic:    topic,
		Balancer: &kafkaGo.LeastBytes{},
	}
}

func newKafkaReader(urls, groupID, topic string) *kafkaGo.Reader {
	brokers := strings.Split(urls, ",")
	return kafkaGo.NewReader(kafkaGo.ReaderConfig{
		Brokers:  brokers,
		GroupID:  groupID,
		Topic:    topic,
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})
}

func consumeMessages(reader *kafkaGo.Reader, wg *sync.WaitGroup) {
	defer wg.Done()
	fmt.Println("Starting consumer...")

	for {
		m, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message: %v", err)
			continue // Log the error but keep consuming
		}
		fmt.Printf("Message at topic:%v partition:%v offset:%v key:%s value:%s\n",
			m.Topic, m.Partition, m.Offset, string(m.Key), string(m.Value))
	}
}

func produceMessages(writer *kafkaGo.Writer, wg *sync.WaitGroup, id int) {
	defer wg.Done()
	i := 0
	for {
		key := fmt.Sprintf("Key-%d-Producer-%d", i, id)
		msg := kafkaGo.Message{
			Key:   []byte(key),
			Value: []byte(fmt.Sprintf("hello from producer %d: %d", id, i)),
		}
		err := writer.WriteMessages(context.Background(), msg)
		if err != nil {
			log.Printf("Error writing message from producer %d: %v", id, err)
		} else {
			fmt.Printf("Produced message from producer %d: %s\n", id, string(msg.Value))
			i++
		}
	}
}

func main() {
	var wg sync.WaitGroup

	// Create and start 10 Kafka writers (producers)
	for i := 1; i <= 3; i++ {
		writer := newKafkaWriter(BootstrapServers, Topic)
		wg.Add(1)
		go produceMessages(writer, &wg, i)
	}

	// Create and start 3 Kafka readers (consumers) for consuming messages
	for i := 0; i < 3; i++ {
		reader := newKafkaReader(BootstrapServers, GroupID+"."+strconv.Itoa(i), Topic)
		wg.Add(1)
		go consumeMessages(reader, &wg)
	}

	// Wait for all producers and consumers to finish (this will run indefinitely in this case)
	wg.Wait()
}
