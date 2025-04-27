package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"orderservice/graph"
	db "orderservice/internal/db"
	"orderservice/internal/repository"
	"orderservice/internal/services"
	"orderservice/internal/sqs"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/joho/godotenv"
)

func graphqlHandler(orderService *services.OrderService) http.HandlerFunc {
	// NewExecutableSchema and Config are in the generated.go file
	// Resolver is in the resolver.go file

	h := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{OrderService: orderService}}))
	h.AddTransport(transport.POST{})

	h.AddTransport(transport.Options{})
	h.AddTransport(transport.GET{})
	h.Use(extension.Introspection{})

	return func(w http.ResponseWriter, r *http.Request) {
		r.Header.Set("Content-Type", "application/json")
		h.ServeHTTP(w, r)
	}
}

func loadEnvFile() {
	envPaths := []string{"./.env", "../../.env"}
	var rootEnvPath string
	var err error

	for _, path := range envPaths {
		rootEnvPath, err = filepath.Abs(path)
		if err != nil {
			log.Printf("Error getting absolute path for %s: %v", path, err)
			continue
		}

		err = godotenv.Load(rootEnvPath)
		if err == nil {
			log.Printf("Successfully loaded .env file from: %s", rootEnvPath)
			return
		} else {
			log.Printf("Error loading .env file from %s: %v", rootEnvPath, err)
		}
	}

	log.Printf("Failed to load .env file from any of the specified paths")
}

func main() {
	//try load local env
	loadEnvFile()

	region := os.Getenv("AWS_REGION")
	if region == "" {
		log.Fatal("AWS_REGION environment variable is not set")
	}

	ORDERS_QUEUE_URL := os.Getenv("ORDERS_QUEUE_URL")
	if ORDERS_QUEUE_URL == "" {
		log.Fatal("ORDERS_QUEUE_URL environment variable is not set")
	}

	_, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	ctx := context.Background()

	dbPool, err := db.NewDBPool(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	defer dbPool.Close()

	orderRepo := repository.NewOrderRepository(dbPool.Pool)

	orderService := services.NewOrderService(orderRepo)

	go sqs.StartSQSConsumer(ORDERS_QUEUE_URL, orderService)

	// Use Go's default HTTP server
	http.HandleFunc("/graphql", graphqlHandler(orderService))

	// Start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "9001"
	}
	fmt.Printf("Starting server on :%s\n", port)
	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
