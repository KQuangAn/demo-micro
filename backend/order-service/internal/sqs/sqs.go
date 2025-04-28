package sqs

import (
	"context"
	"fmt"
	"log"
	"orderservice/internal/models"
	"orderservice/internal/services"
	"orderservice/internal/utils"
	"orderservice/internal/validator"
	"orderservice/pkg/enums"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

var client *sqs.Client

var (
	MAX_NUMBER_OF_MESSAGE = utils.GetEnv("MAX_NUMBER_OF_MESSAGE", int32(10))
	WAIT_TIME_SECONDS     = utils.GetEnv("WAIT_TIME_SECONDS", int32(10))
	MAX_CONSUMER          = utils.GetEnv("MAX_CONSUMER", 5)
)

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
	var event models.EventBridgeMessage
	log.Print("Received message", *message.Body)

	valid := msgValidator.ValidateEvent(message, &event)

	if !valid {
		return
	}

	ctx := context.Background()

	switch event.DetailType {
	case enums.EVENT_TYPE.InventoryReserved.String():
		detail := validator.ValidateModel(msgValidator, event.Detail, &models.InventoryReservedEventDetail{})
		if detail == nil {
			log.Println("Failed to validate event", enums.EVENT_TYPE.InventoryReserved.String())
			return
		}

		log.Println("InventoryReserved")
		order, err := orderService.HandleInventoryReservedEvent(ctx, detail.OrderID, detail.ProductID,
			detail.Quantity)
		if err != nil {
			fmt.Printf("Error updating order: %v\n", err)
		} else {
			fmt.Printf("Order updated successfully: %+v\n", order)
		}

	case enums.EVENT_TYPE.InventoryReservationFailed.String():
		detail := validator.ValidateModel(msgValidator, event.Detail, &models.InventoryReservedFailEventDetail{})
		if detail == nil {
			log.Println("Failed to validate event", enums.EVENT_TYPE.InventoryReserved.String())
			return
		}

		order, err := orderService.CancelOrderInsufficentInventory(ctx, detail.OrderID)
		if err != nil {
			fmt.Printf("Error cancelling order: %v\n", err)
		} else {
			fmt.Printf("Order cancelled successfully: %+v\n", order)
		}
	case enums.EVENT_TYPE.NotificationSentSuccess.String():
		log.Println("NotificationSentSuccess")
		detail := validator.ValidateModel(msgValidator, event.Detail, &models.NotificationEventDetail{})
		if detail == nil {
			log.Println("Failed to validate event", enums.EVENT_TYPE.InventoryReserved.String())
			return
		}
		order, err := orderService.HandleInventoryReservedFailedEvent(ctx, detail.ID, detail.ProductID,
			detail.Quantity)
		if err != nil {
			fmt.Printf("Error updating order: %v\n", err)
		} else {
			fmt.Printf("Order updated successfully: %+v\n", order)
		}
	default:
		log.Printf("Unhandled event type: %s", event.DetailType)
	}
}

func StartSQSConsumer(queueURL string, orderService *services.OrderService) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown support
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	jobs := make(chan types.Message, 50)
	var wg sync.WaitGroup

	msgValidator := validator.New()
	log.Println("Now accepting messages")

	for i := 0; i < MAX_CONSUMER; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for msg := range jobs {
				processMessage(&msg, msgValidator, queueURL, orderService)
			}
		}(i)
	}

	log.Println("SQS Consumer running...")

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Println("Stopping message fetcher...")
				return
			default:
				output := receiveMessages(ctx, queueURL)
				for _, msg := range output.Messages {
					select {
					case jobs <- msg: // enqueue message
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	<-sigs
	log.Println("Shutdown signal received. Cleaning up...")

	cancel()

	close(jobs)
	wg.Wait()

	log.Println("All workers exited. Shutdown complete.")
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
