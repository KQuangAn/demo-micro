.PHONY: build run test clean docker-up docker-down lint fmt help

# Variables
APP_NAME=kafka-go-app
CMD_PATH=./cmd/app
BUILD_DIR=./bin

## help: Display this help message
help:
	@echo "Available targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/##//'

## build: Build the application
build:
	@echo "Building application..."
	@go build -o $(BUILD_DIR)/$(APP_NAME) $(CMD_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(APP_NAME)"

## run: Run the application
run:
	@echo "Running application..."
	@go run $(CMD_PATH)/main.go

## test: Run all tests
test:
	@echo "Running tests..."
	@go test -v ./...

## test-cover: Run tests with coverage
test-cover:
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

## lint: Run linter
lint:
	@echo "Running linter..."
	@golangci-lint run ./...

## fmt: Format code
fmt:
	@echo "Formatting code..."
	@go fmt ./...
	@goimports -w .

## tidy: Tidy go modules
tidy:
	@echo "Tidying go modules..."
	@go mod tidy

## docker-up: Start Docker services (Kafka cluster)
docker-up:
	@echo "Starting Docker services..."
	@docker-compose up -d
	@echo "Services started. Kafdrop UI: http://localhost:9000"

## docker-down: Stop Docker services
docker-down:
	@echo "Stopping Docker services..."
	@docker-compose down

## docker-logs: View Docker logs
docker-logs:
	@docker-compose logs -f

## topic-create: Create a Kafka topic (usage: make topic-create TOPIC=my-topic)
topic-create:
	@echo "Creating topic: $(TOPIC)..."
	@go run ./cmd/topic-manager/main.go -action=create -topic=$(TOPIC) -partitions=3 -replication=3

## topic-list: List all Kafka topics
topic-list:
	@echo "Listing topics..."
	@go run ./cmd/topic-manager/main.go -action=list

## topic-delete: Delete a Kafka topic (usage: make topic-delete TOPIC=my-topic)
topic-delete:
	@echo "Deleting topic: $(TOPIC)..."
	@go run ./cmd/topic-manager/main.go -action=delete -topic=$(TOPIC)

## cluster-info: Show Kafka cluster information
cluster-info:
	@echo "Fetching cluster metadata..."
	@go run ./cmd/cluster-info/main.go -action=all

## cluster-controller: Show the controller broker
cluster-controller:
	@echo "Fetching controller info..."
	@go run ./cmd/cluster-info/main.go -action=controller

## topic-info: Show information about a specific topic (usage: make topic-info TOPIC=my-topic)
topic-info:
	@echo "Fetching topic info for: $(TOPIC)..."
	@go run ./cmd/cluster-info/main.go -action=topic -topic=$(TOPIC)

## clean: Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

## install-tools: Install development tools
install-tools:
	@echo "Installing development tools..."
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@go install golang.org/x/tools/cmd/goimports@latest
	@echo "Tools installed"

## mod-download: Download go modules
mod-download:
	@echo "Downloading modules..."
	@go mod download

## all: Run fmt, lint, test, and build
all: fmt lint test build
	@echo "All tasks completed"
