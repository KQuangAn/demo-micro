package main

import (
	"fmt"

	validator "github.com/go-playground/validator/v10"
)

type EventQueueFactory struct{}

type Provider string

const (
	Kafka Provider = "Kafka"
	SQS   Provider = "SQS"         
)


func (f *EventQueueFactory) CreateConnection(queueType string, options interface{}) (EventQueue, error) {
	validate := validator.New()

	switch queueType {
	case "kafka":
		kafkaOptions, ok := options.(KafkaOptions)
		if !ok {
			return nil, fmt.Errorf("invalid options for Kafka")
		}
		// Validate Kafka options
		if err := validate.Struct(kafkaOptions); err != nil {
			return nil, fmt.Errorf("invalid Kafka options: %v", err)
		}
		conn := &KafkaConn{}
		// Initialize Kafka connection using kafkaOptions
		return conn, nil
	case "sqs":
		sqsOptions, ok := options.(SQSOptions)
		if !ok {
			return nil, fmt.Errorf("invalid options for SQS")
		}
		// Validate SQS options
		if err := validate.Struct(sqsOptions); err != nil {
			return nil, fmt.Errorf("invalid SQS options: %v", err)
		}
		conn := &SQSConn{}
		// Initialize SQS connection using sqsOptions
		return conn, nil
	default:
		return nil, fmt.Errorf("unsupported queue type: %s", queueType)
	}
}
