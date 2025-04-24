package sqs

import (
	"context"
	"fmt"
	"log"
	"orderservice/graph/model"
	"orderservice/internal/models"
	"orderservice/internal/services"
	"orderservice/internal/validator"
	"orderservice/pkg/enums"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

var client *sqs.Client

const MAX_NUMBER_OF_MESSAGE = 10
const WAIT_TIME_SECONDS = 5

func init() {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithEndpointResolver(aws.EndpointResolverFunc(
		func(service, region string) (aws.Endpoint, error) {
			if service == sqs.ServiceID && region == "ap-southeast-1" {
				return aws.Endpoint{
					URL: "http://sqs.ap-southeast-1.localhost.localstack.cloud:4566",
				}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		},
	)))

	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}
	client = sqs.NewFromConfig(cfg)

}

func handleMessage(message *types.Message, msgValidator *validator.Validator, orderService *services.OrderService) {
	//validate
	var event models.EventBridgeMessage
	log.Print("Received message", *message.Body)

	valid := msgValidator.Validate(message, &event)

	if !valid {
		return
	}

	//check which type of event it is
	ctx := context.Background()
	switch event.DetailType {
	case enums.EVENT_TYPE.InventoryReserved.String():
		log.Println("InventoryReserved")
		order, err := orderService.UpdateOrder(ctx, event.Detail.ID, event.Detail.ProductID, event.Detail.Quantity, model.OrderStatus(model.OrderStatusPending.String()))
		if err != nil {
			fmt.Printf("Error updating order: %v\n", err)
		} else {
			fmt.Printf("Order updated successfully: %+v\n", order)
		}

	case enums.EVENT_TYPE.InventoryReservationFailed.String():
		log.Println("InventoryReservedfailed")
		order, err := orderService.CancelOrder(ctx, event.Detail.ID)
		if err != nil {
			fmt.Printf("Error cancelling order: %v\n", err)
		} else {
			fmt.Printf("Order cancelled successfully: %+v\n", order)
		}
	}

}

func StartSQSConsumer(queueURL string, orderService *services.OrderService) {
	ctx := context.Background()

	msgValidator := validator.New()
	log.Println("Now accepting messages")

	for {
		output := receiveMessages(ctx, queueURL)
		for _, msg := range output.Messages {
			processMessage(&msg, msgValidator, queueURL, orderService)
		}
	}
}

func receiveMessages(ctx context.Context, queueURL string) *sqs.ReceiveMessageOutput {
	output, err := client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            aws.String(queueURL),
		MaxNumberOfMessages: MAX_NUMBER_OF_MESSAGE,
		WaitTimeSeconds:     WAIT_TIME_SECONDS,
	})

	if err != nil {
		log.Printf("Error receiving message: %v", err)
		return &sqs.ReceiveMessageOutput{}
	}
	return output
}

func processMessage(msg *types.Message, msgValidator *validator.Validator, queueURL string, orderService *services.OrderService) {
	handleMessage(msg, msgValidator, orderService)
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
