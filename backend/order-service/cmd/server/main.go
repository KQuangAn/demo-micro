package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"orderservice/graph"
	"orderservice/internal/db"
	"orderservice/internal/sqs"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/joho/godotenv"
)

func handleMessage(message string) {
	fmt.Printf("Processing message: %s\n", message)
}

func graphqlHandler(dbPool *db.DBPool) http.HandlerFunc {
	// NewExecutableSchema and Config are in the generated.go file
	// Resolver is in the resolver.go file
	h := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{DB: dbPool.Pool}}))
	return func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	}
}

func main() {
	rootEnvPath, err := filepath.Abs("../../.env")
	if err != nil {
		log.Fatalf("Error getting absolute path: %v", err)
	}

	err = godotenv.Load(rootEnvPath)
	if err != nil {
		log.Fatalf("Error loading .env file from root: %v", err)
	}

	region := os.Getenv("AWS_REGION")
	if region == "" {
		log.Fatal("AWS_REGION environment variable is not set")
	}

	ORDERS_QUEUE_URL := os.Getenv("ORDERS_QUEUE_URL")
	if ORDERS_QUEUE_URL == "" {
		log.Fatal("ORDERS_QUEUE_URL environment variable is not set")
	}

	_, err = config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	go sqs.StartSQSConsumer(handleMessage, ORDERS_QUEUE_URL)
	ctx := context.Background()

	dbPool, err := db.NewDBPool(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	defer dbPool.Close()

	// Use Go's default HTTP server
	http.HandleFunc("/query", graphqlHandler(dbPool))

	// Start the server
	port := "8080"
	fmt.Printf("Starting server on :%s\n", port)
	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
