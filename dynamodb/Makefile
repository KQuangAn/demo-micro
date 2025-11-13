.PHONY: help setup start stop logs clean create-table run-app run-queries test

help: ## Show this help message
	@echo "Available commands:"
	@echo "  make setup         - Set up everything (start LocalStack, install deps, create table)"
	@echo "  make start         - Start LocalStack"
	@echo "  make stop          - Stop LocalStack"
	@echo "  make logs          - View LocalStack logs"
	@echo "  make clean         - Clean up LocalStack data"
	@echo "  make create-table  - Create DynamoDB table"
	@echo "  make run-app       - Run basic CRUD examples"
	@echo "  make run-queries   - Run advanced query examples"
	@echo "  make deps          - Download Go dependencies"
	@echo "  make test          - Run all examples"

setup: start deps create-table ## Complete setup
	@echo ""
	@echo "Setup complete! Run 'make run-app' to see examples."

start: ## Start LocalStack
	@echo "Starting LocalStack..."
	@docker-compose up -d
	@echo "Waiting for LocalStack to be ready..."
	@sleep 5

stop: ## Stop LocalStack
	@echo "Stopping LocalStack..."
	@docker-compose down

logs: ## View LocalStack logs
	@docker-compose logs -f

clean: ## Clean up all data
	@echo "Cleaning up..."
	@docker-compose down -v
	@rm -rf localstack-data/
	@echo "✓ Cleanup complete"

deps: ## Download Go dependencies
	@echo "Downloading Go dependencies..."
	@go mod download
	@echo "✓ Dependencies installed"

create-table: ## Create DynamoDB table
	@echo "Creating DynamoDB table..."
	@go run cmd/create_table/main.go

run-app: ## Run basic CRUD examples
	@go run cmd/app/main.go

run-queries: ## Run advanced query examples
	@go run cmd/queries/main.go

test: run-app run-queries ## Run all examples
	@echo ""
	@echo "All examples completed!"
