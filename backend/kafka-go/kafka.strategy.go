package main

import (
	"context"
	"fmt"
	"log"
	"time"

	kafka "github.com/segmentio/kafka-go"
)

type Kafka interface {
	EventQueue
	commitOffset(offset int64) error //extends functionality of EventQueue , specific to kafka
}

type KafkaOptions struct {
	URL       string `validate:"required,url"`
	Topic     string `validate:"required"`
	Partition int    `validate:"required,min=1"`
}

type KafkaConn struct {
	connection *kafka.Conn
}

func (kc *KafkaConn) Connect(args interface{}) error {
	a, ok := args.(KafkaOptions)
	if !ok {
		return fmt.Errorf("invalid options for Kafka")
	}
	// Implement connection logic
	conn, err := kafka.DialLeader(context.Background(), "tcp", a.URL, a.Topic, a.Partition)
	if err != nil {
		log.Fatal("failed to dial leader:", err)
	}

	kc.connection = conn
	return nil

}

// Publish method for KafkaConn
func (kc *KafkaConn) Publish(msgs []string) error {
	// Implement publish logic
	conn := kc.connection

	var err error
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	for _, msg := range msgs {
		_, err = conn.WriteMessages(
			kafka.Message{Value: []byte(msg)})
	}
	if err != nil {
		fmt.Println("failed to write messages:", err)
	}
	return err
}

// Subscribe method for KafkaConn
func (kc *KafkaConn) Subscribe() error {
	// Implement subscribe logic
	batch := kc.connection.ReadBatch(10e3, 1e6)
	b := make([]byte, 10e3)
	for {
		n, err := batch.Read(b)
		if err != nil {
			break
		}
		fmt.Println(string(b[:n]))
	}

	return nil
}

// Close method for KafkaConn
func (kc *KafkaConn) Close() error {
	if kc.connection != nil {
		return kc.connection.Close()
	}
	return nil
}

func (kc *KafkaConn) GetCurrentOffset() (error, int64, int) {
	if kc.connection != nil {
		offset, whence := kc.connection.Offset()
		return nil, offset, whence
	}
	return fmt.Errorf("connection is nil"), 0, 0
}
