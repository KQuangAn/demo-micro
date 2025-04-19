package main

import (
	"context"
	"fmt"
	"log"
	"orderservice/internal/sqs"
	"os"
	"os/signal"
	"syscall"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/joho/godotenv"
)
func handleMessage(message string) {
    fmt.Printf("Processing message: %s\n", message)
}

func main() {
	err := godotenv.Load()
    if err != nil {
        log.Fatal("Error loading .env file")
    }

	region := os.Getenv("AWS_REGION")
    if region == "" {
        log.Fatal("AWS_REGION environment variable is not set")
    }

    cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
    if err != nil {
        log.Fatalf("unable to load SDK config, %v", err)
    }
    fmt.Println(cfg)
	
	// Start the SQS poller in a separate goroutine
	go sqs.StartSQSConsumer(handleMessage)
	
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	// Initialize the GraphQL server
	// r := gin.Default()
	// r.POST("/query", handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: &graph.Resolver{}})))
	// r.GET("/", playground.Handler("GraphQL playground", "/query"))

	// // Start the HTTP server
	// r.Run(":8080")
}