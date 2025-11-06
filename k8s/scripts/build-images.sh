#!/bin/bash

set -e

echo "=========================================="
echo "Building Docker Images for Kubernetes"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# If using minikube, use minikube's docker daemon
if command -v minikube &> /dev/null; then
    if minikube status &> /dev/null; then
        print_info "Using minikube's Docker daemon..."
        eval $(minikube docker-env)
    fi
fi

# Build API Gateway
print_info "Building API Gateway image..."
docker build -t api-gateway:latest ./backend/api-gateway
print_success "API Gateway image built successfully"

# Build Order Service
print_info "Building Order Service image..."
docker build -t order-service:latest ./backend/order-service
print_success "Order Service image built successfully"

# Build Inventory Service
print_info "Building Inventory Service image..."
docker build -t inventory-service:latest ./backend/inventory-service
print_success "Inventory Service image built successfully"

# Build Notification Service
print_info "Building Notification Service image..."
docker build -t notification-service:latest ./backend/notification-service
print_success "Notification Service image built successfully"

# Optional: Build Frontend
if [ -d "./frontend" ]; then
    read -p "Do you want to build the Frontend image? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Building Frontend image..."
        docker build -t frontend:latest ./frontend
        print_success "Frontend image built successfully"
    fi
fi

print_success "All images built successfully!"

echo ""
echo "Built images:"
docker images | grep -E "(api-gateway|order-service|inventory-service|notification-service|frontend)" | grep latest || true
