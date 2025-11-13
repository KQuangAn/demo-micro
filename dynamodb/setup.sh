#!/bin/bash

# Setup script for DynamoDB LocalStack project
# This script will set up everything you need to get started

echo "=================================================="
echo "  DynamoDB LocalStack - Setup Script"
echo "=================================================="

# Check if Docker is running
echo ""
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "✗ Docker is not running. Please start Docker and try again."
    exit 1
fi
echo "✓ Docker is running"

# Check if Go is installed
echo ""
echo "Checking Go..."
if ! command -v go &> /dev/null; then
    echo "✗ Go is not installed. Please install Go 1.21 or higher."
    exit 1
fi
GO_VERSION=$(go version)
echo "✓ $GO_VERSION found"

# Start LocalStack
echo ""
echo "Starting LocalStack..."
docker-compose up -d

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo "✓ LocalStack is ready"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
    echo -n "."
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "✗ LocalStack failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Install Go dependencies
echo ""
echo "Installing Go dependencies..."
go mod download

echo "✓ Dependencies installed"

# Create the DynamoDB table
echo ""
echo "Creating DynamoDB table..."
go run cmd/create_table/main.go

echo ""
echo "=================================================="
echo "  Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. Run examples:       go run cmd/app/main.go"
echo "  2. Try advanced queries: go run cmd/queries/main.go"
echo "  3. View logs:          docker-compose logs -f"
echo "  4. Stop LocalStack:    docker-compose down"
echo ""
echo "Happy coding! 🚀"
