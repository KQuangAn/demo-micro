package sqs

import (
	"context"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

func StartSQSConsumer(pushToBridge func(message string)) {
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	client := sqs.NewFromConfig(cfg)
	queueURL := os.Getenv("ORDERS_QUEUE_URL")
    if queueURL == "" {
        log.Fatal("ORDERS_QUEUE_URL environment variable is not set")
    }

	for {
		output, err := client.ReceiveMessage(context.TODO(), &sqs.ReceiveMessageInput{
			QueueUrl:            aws.String(queueURL),
			MaxNumberOfMessages: 10,
			WaitTimeSeconds:     5,
		})
		if err != nil {
			log.Printf("error receiving message: %v", err)
			continue
		}

		for _, msg := range output.Messages {
			log.Printf("Received message: %s", *msg.Body)
			pushToBridge(*msg.Body)

			// delete message
			_, _ = client.DeleteMessage(context.TODO(), &sqs.DeleteMessageInput{
				QueueUrl:      aws.String(queueURL),
				ReceiptHandle: msg.ReceiptHandle,
			})
		}
	}
}
