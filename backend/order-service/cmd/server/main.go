package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"orderservice/graph"
	"orderservice/internal/db"
	eventemitter "orderservice/internal/event_emitter"
	eventhandler "orderservice/internal/event_handler"
	"orderservice/internal/repository"
	"orderservice/internal/services"
	"orderservice/internal/sqs"
	"orderservice/internal/utils"
	"orderservice/internal/validator"
	"orderservice/pkg/enums"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	eb "github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"gorm.io/gorm"
)

// Helper function to initialize services and repositories
func initializeServices(ctx context.Context, dbConn *gorm.DB) (services.OrderService, *validator.Validator) {
	// Create repositories
	ordersRepo := repository.NewOrderRepository(dbConn)

	// Create services

	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithEndpointResolver(aws.EndpointResolverFunc(
		func(service, region string) (aws.Endpoint, error) {
			if service == eb.ServiceID && region == "ap-southeast-1" {
				return aws.Endpoint{
					URL: "http://eventbridge.ap-southeast-1.localhost.localstack.cloud:4566",
				}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		},
	)))

	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}

	emitter := eventemitter.NewEventBridgeEmitter(cfg)

	orderService := services.NewOrderService(ordersRepo, emitter, dbConn)

	// Create validator
	v := validator.New()

	return orderService, v
}

// Set up the GraphQL handler
func graphqlHandler(orderService services.OrderService) http.HandlerFunc {
	TIMEOUT := utils.GetEnv("REQUEST_TIMEOUT", 30)
	h := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{OrderService: orderService}}))
	h.AddTransport(transport.POST{})
	h.AddTransport(transport.Options{})
	h.AddTransport(transport.GET{})
	h.Use(extension.Introspection{})

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Duration(TIMEOUT)*time.Second)
		defer cancel()

		r = r.WithContext(ctx)
		r.Header.Set("Content-Type", "application/json")
		h.ServeHTTP(w, r)
	}
}

// setup initializes the services, event handlers, and other components of the application
func setup(ctx context.Context) (services.OrderService, *validator.Validator, *eventhandler.HandlerRegistry, *eventhandler.EventHandler, func()) {
	dbPool, err := db.NewDBPool(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	// Ensure the pool is closed when the app shuts down (call site handles lifecycle)

	orderService, v := initializeServices(ctx, dbPool.DB)

	registry := eventhandler.NewHandlerRegistry()
	eh := eventhandler.NewEventHandler(registry, v)

	registry.Register(enums.EVENT_TYPE.InventoryReserved.String(), eventhandler.NewInventoryReservedHandler(orderService, v))

	closer := func() {
		if err := dbPool.Close(); err != nil {
			log.Printf("error closing DB pool: %v", err)
		}
	}

	return orderService, v, registry, eh, closer
}

func setUpLogger() {
	// Get the current date
	currentDate := time.Now().Format("2006-01-02") // Format: YYYY-MM-DD
	logDir := "../../logs"
	logFilePath := filepath.Join(logDir, currentDate+".log")

	// Create the logs directory if it does not exist
	if err := os.MkdirAll(logDir, os.ModePerm); err != nil {
		log.Fatal(err)
	}

	// Open the log file
	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	// Set the log output to the file
	log.SetOutput(file)
}

func main() {
	setUpLogger()

	ctx, cancel := context.WithCancel(context.Background())
	utils.LoadEnvFile(ctx)

	defer cancel()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)

	orderService, _, _, eh, closeDB := setup(ctx)

	ordersQueueURl := utils.GetEnv("ORDERS_QUEUE_URL", "")
	maxConsumer := utils.GetEnv("MAX_CONSUMER", 5)

	go sqs.NewSQSConsumer(ctx, *eh, ordersQueueURl, maxConsumer)

	srv := &http.Server{
		Addr:    ":" + utils.GetEnv("PORT", "9001"),
		Handler: http.HandlerFunc(graphqlHandler(orderService)),
	}

	go func() {
		fmt.Printf("Starting server on %s\n", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	<-sigs
	log.Println("Shutdown signal received.")

	// Gracefully stop everything
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
	cancel() // this stops the SQS consumer
	closeDB()

}
