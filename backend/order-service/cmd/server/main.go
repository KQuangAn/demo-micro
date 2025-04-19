package main

import (
	"context"
	"fmt"

	"log"
	"orderservice/graph"

	"orderservice/internal/db"
	"orderservice/internal/sqs"
	"os"
	"path/filepath"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func handleMessage(message string) {
	fmt.Printf("Processing message: %s\n", message)
}

func graphqlHandler(dbPool *db.DBPool) gin.HandlerFunc {
	// NewExecutableSchema and Config are in the generated.go file
	// Resolver is in the resolver.go file
	h := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{DB: dbPool.Pool}}))
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// Defining the Playground handler
func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL", "/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
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
	// run read endpoint
	r := gin.Default()
	r.POST("/query", graphqlHandler(dbPool))
	r.Run()

}
