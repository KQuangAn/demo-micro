package main

import (
	"log"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func main() {
	producer, err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": "localhost:9092"})
	if err != nil {
		log.Fatalf("Fail")
	}
	defer producer.Close()
	deliverChan := make(chan kafka.Event, 10000)

	topic := "new-topic"
	err := producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          []byte(word),
	},
		deliverChan,
	)
	if err != nil {
		log.Fatal(err)
	}

	e := <-deliverChan

	go func() {
		consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
			"bootstrap.servers": "localhost:9092",
			"group.id":          "my-group",
			"auto.offset.reset": "earliest",
		})
		if err != nil {
			log.Fatalf("Fail")
		}
		defer consumer.Close()

		topic := "new-topic"
		if err := consumer.Subscribe(topic, nil); err != nil {
			log.Fatal("fail to subscribe")
		}

		for {
			msg, err := consumer.ReadMessage(-1)
			if err == nil {
				log.Printf("Consumed message: %s", string(msg.Value))
			} else {
				log.Printf("Consumer error: %v", err)
			}
		}

	}()

}
