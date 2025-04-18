package sqs

import (
	"context"
	"encoding/json"
	"log"
	"orderservice/internal/models"
	"orderservice/internal/validator"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

var client *sqs.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}
	client = sqs.NewFromConfig(cfg)

}

func SendEventToQueue(queueUrl string, event interface{}) error {

	messageBody, err := json.Marshal(event)
	if err != nil {
		return err
	}

	_, err = client.SendMessage(context.TODO(), &sqs.SendMessageInput{
		QueueUrl:    aws.String(queueUrl),
		MessageBody: aws.String(string(messageBody)),
	})
	return err
}

func StartSQSConsumer(pushToBridge func(message string), queueURL string) {
	ctx := context.Background()

	msgValidator := validator.New()
	log.Println("Now accepting messages")

	for {
		output := receiveMessages(ctx, queueURL)
		for _, msg := range output.Messages {
			processMessage(msg, msgValidator, pushToBridge, queueURL)
		}
	}
}

func receiveMessages(ctx context.Context, queueURL string) *sqs.ReceiveMessageOutput {
	output, err := client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            aws.String(queueURL),
		MaxNumberOfMessages: 10,
		WaitTimeSeconds:     5,
	})
	if err != nil {
		log.Printf("error receiving message: %v", err)
		return &sqs.ReceiveMessageOutput{}
	}
	return output
}

func processMessage(msg types.Message, msgValidator *validator.Validator, callback func(message string), queueURL string) {
	var order models.Order
	log.Printf("Received message: %s", *msg.Body)

	if err := json.Unmarshal([]byte(*msg.Body), &order); err != nil {
		log.Printf("Invalid JSON format: %v", err)
		deleteMessage(queueURL, *msg.ReceiptHandle)
		return
	}

	valid := msgValidator.Validate(*msg.Body, &order)

	if valid {
		callback(*msg.Body)
	}

	deleteMessage(queueURL, *msg.ReceiptHandle)
}

func deleteMessage(queueURL string, receiptHandle string) {
	_, err := client.DeleteMessage(context.TODO(), &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(queueURL),
		ReceiptHandle: aws.String(receiptHandle),
	})
	if err != nil {
		log.Printf("Error deleting message: %v", err)
	}
}
