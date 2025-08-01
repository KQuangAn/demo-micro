package sqs

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	eventhandler "orderservice/internal/event_handler"
	"orderservice/internal/models"
	"orderservice/internal/utils"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

var (
	client                *sqs.Client
	MAX_NUMBER_OF_MESSAGE = utils.GetEnv("MAX_NUMBER_OF_MESSAGE", int32(10))
	WAIT_TIME_SECONDS     = utils.GetEnv("WAIT_TIME_SECONDS", int32(10))
	TIMEOUT               = time.Duration(utils.GetEnv("TIMEOUT", int32(30))) * time.Second
)

func init() {
	ctx, cancel := context.WithTimeout(context.Background(), TIMEOUT)
	defer cancel()

	var err error
	client, err = createSQSClient(ctx)
	if err != nil {
		log.Fatalf("Failed to create SQS client: %v", err)
	}
}

func createSQSClient(ctx context.Context) (*sqs.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithEndpointResolver(aws.EndpointResolverFunc(
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
		return nil, err
	}
	return sqs.NewFromConfig(cfg), nil
}

type SQSConsumer struct {
	client       *sqs.Client
	eventHandler eventhandler.EventHandler
	queueURL     string
	maxConsumers int
}

func NewSQSConsumer(ctx context.Context, eventHandler eventhandler.EventHandler, queueURL string, maxConsumers int) *SQSConsumer {
	consumer := &SQSConsumer{
		client:       client,
		eventHandler: eventHandler,
		queueURL:     queueURL,
		maxConsumers: maxConsumers,
	}
	go consumer.start(ctx)
	return consumer
}

func (c *SQSConsumer) start(ctx context.Context) {

	jobs := make(chan types.Message, 50)
	var wg sync.WaitGroup

	for i := 0; i < c.maxConsumers; i++ {
		wg.Add(1)
		go c.worker(ctx, jobs, &wg)
	}

	log.Println("SQS Consumer running...")

	go c.fetchMessages(ctx, jobs)

	<-ctx.Done()
	log.Println("Shutdown signal received. Cleaning up...")

	close(jobs)
	wg.Wait()
	log.Println("All workers exited. Shutdown complete.")
}

func (c *SQSConsumer) worker(ctx context.Context, jobs <-chan types.Message, wg *sync.WaitGroup) {
	defer wg.Done()
	for msg := range jobs {
		ctx, cancel := context.WithTimeout(ctx, TIMEOUT)
		var event models.Event
		if err := json.Unmarshal([]byte(*msg.Body), &event); err != nil {
			log.Printf("Failed to unmarshal event body: %v", err)
			//c.deleteMessage(*msg.ReceiptHandle)
			cancel()
			continue
		}

		if err := c.eventHandler.HandleMessage(ctx, &event); err != nil {
			c.deleteMessage(*msg.ReceiptHandle)
		}
	}
}

func (c *SQSConsumer) fetchMessages(ctx context.Context, jobs chan<- types.Message) {
	for {
		select {
		case <-ctx.Done():
			log.Println("Stopping message fetcher...")
			return
		default:
			output := c.receiveMessages(ctx)
			for _, msg := range output.Messages {
				select {
				case jobs <- msg:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

func (c *SQSConsumer) receiveMessages(ctx context.Context) *sqs.ReceiveMessageOutput {
	output, err := c.client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            aws.String(c.queueURL),
		MaxNumberOfMessages: MAX_NUMBER_OF_MESSAGE,
		WaitTimeSeconds:     WAIT_TIME_SECONDS,
	})

	if err != nil {
		log.Printf("Error receiving message: %v", err)
		return &sqs.ReceiveMessageOutput{}
	}
	return output
}

func (c *SQSConsumer) deleteMessage(receiptHandle string) {
	_, err := c.client.DeleteMessage(context.Background(), &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(c.queueURL),
		ReceiptHandle: aws.String(receiptHandle),
	})
	if err != nil {
		log.Printf("Error deleting message: %v", err)
	}
}
