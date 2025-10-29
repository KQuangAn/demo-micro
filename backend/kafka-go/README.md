# Kafka-Go Message Queue Service

A Go-based message queue service supporting multiple providers (Kafka, SQS) with a clean, idiomatic structure.

## Project Structure

```
kafka-go/
├── cmd/
│   └── app/              # Application entry points
│       └── main.go       # Main application
├── internal/             # Private application code
│   └── providers/        # Message queue provider implementations
│       ├── kafka/        # Kafka implementation
│       │   └── kafka.go
│       └── sqs/          # AWS SQS implementation
│           └── sqs.go
├── pkg/                  # Public API
│   └── queue/            # Queue interface and factory
│       ├── queue.go      # Queue interface definition
│       └── factory.go    # Factory for creating queue instances
├── docker-compose.yml    # Docker compose for Kafka cluster
├── go.mod
└── README.md
```

## Architecture

### Design Principles

1. **Separation of Concerns**: Clear separation between public API (`pkg/`), private implementation (`internal/`), and application entry points (`cmd/`)
2. **Factory Pattern**: Flexible provider selection through factory
3. **Interface-Based Design**: All providers implement the `queue.Queue` interface
4. **Context Propagation**: Proper context handling for cancellation and timeouts
5. **Dependency Inversion**: High-level modules don't depend on low-level implementations

### Package Organization

- **`pkg/queue`**: Public API - can be imported by external projects
  - `Queue` interface: Defines message queue operations
  - `Factory`: Creates queue instances based on provider type
- **`internal/providers`**: Private implementations - cannot be imported externally
  - `kafka/`: Kafka-specific implementation
  - `sqs/`: AWS SQS-specific implementation
- **`cmd/app`**: Application entry point
  - `main.go`: Demonstrates usage of the queue service

## Usage

### Basic Example

```go
package main

import (
    "context"
    "log"

    "github.com/demo-micro/backend/kafka-go/pkg/queue"
    "github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
)

func main() {
    ctx := context.Background()

    // Create factory
    factory := queue.NewFactory()

    // Configure Kafka
    opts := kafka.Options{
        Brokers: []string{"localhost:9092", "localhost:9093", "localhost:9094"},
        Topic:   "my-topic",
        GroupID: "my-group",
    }

    // Create connection
    q, err := factory.CreateConnection(ctx, queue.ProviderKafka, opts)
    if err != nil {
        log.Fatal(err)
    }
    defer q.Close()

    // Publish messages
    q.Publish(ctx, []string{"message1", "message2"})

    // Subscribe to messages
    go q.Subscribe(ctx)
}
```

### Using SQS

```go
import (
    "github.com/demo-micro/backend/kafka-go/internal/providers/sqs"
)

opts := sqs.Options{
    QueueURL: "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
    Region:   "us-east-1",
}

q, err := factory.CreateConnection(ctx, queue.ProviderSQS, opts)
```

## Running the Application

### Start Kafka Cluster

```bash
docker-compose up -d
```

This starts:

- 3 Kafka brokers (localhost:9092, 9093, 9094)
- 1 Zookeeper instance
- Kafdrop UI (http://localhost:9000)

### Run the Application

```bash
# From the project root
go run cmd/app/main.go

# Or build and run
go build -o bin/app cmd/app/main.go
./bin/app
```

### Environment Variables

```bash
export TOPIC=my-topic
export GROUP_ID=my-consumer-group
```

## Development

### Adding a New Provider

1. Create a new package in `internal/providers/<provider-name>/`
2. Implement the `queue.Queue` interface
3. Update `pkg/queue/factory.go` to support the new provider
4. Add provider type constant in `pkg/queue/queue.go`

Example:

```go
// internal/providers/rabbitmq/rabbitmq.go
package rabbitmq

type Connection struct {
    // ...
}

func (c *Connection) Connect(ctx context.Context, args interface{}) error {
    // Implementation
}

// Implement other Queue interface methods...
```

### Testing

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run tests for specific package
go test ./pkg/queue
go test ./internal/providers/kafka
```

## Best Practices Implemented

1. ✅ **Standard Go Project Layout**: Following [golang-standards/project-layout](https://github.com/golang-standards/project-layout)
2. ✅ **Exported Interfaces in `pkg/`**: Public API surface
3. ✅ **Internal Package**: Private implementation details
4. ✅ **Context Propagation**: All operations accept `context.Context`
5. ✅ **Error Wrapping**: Using `fmt.Errorf` with `%w` for error chains
6. ✅ **Graceful Shutdown**: Proper signal handling and cleanup
7. ✅ **Dependency Injection**: Factory pattern for flexibility
8. ✅ **Interface Segregation**: Small, focused interfaces
9. ✅ **Naming Conventions**: Clear, Go-idiomatic names
10. ✅ **Package Documentation**: Comments on exported types

## Dependencies

- `github.com/segmentio/kafka-go` - Kafka client
- `github.com/aws/aws-sdk-go-v2` - AWS SDK for SQS
- `github.com/go-playground/validator/v10` - Struct validation

## License

MIT
