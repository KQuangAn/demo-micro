#!/bin/bash

# All-in-One: Build Docker Images and Deploy to Kubernetes
# This script builds all images then deploys everything

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "Build and Deploy - Demo Micro"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker."
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed."
    exit 1
fi

print_info "Docker and kubectl are ready"
echo ""

# ====================
# STEP 1: BUILD IMAGES
# ====================
echo "=========================================="
echo "STEP 1: Building Docker Images"
echo "=========================================="
echo ""

# If using minikube, use its Docker daemon
if command -v minikube &> /dev/null; then
    if minikube status > /dev/null 2>&1; then
        print_info "Using minikube's Docker daemon..."
        eval $(minikube docker-env)
    fi
fi

# Navigate to project root
cd ../..

# Build API Gateway
print_info "Building API Gateway..."
docker build -t api-gateway:latest backend/api-gateway
print_success "API Gateway built"

# Build Order Service
echo ""
print_info "Building Order Service..."
docker build -t order-service:latest backend/order-service
print_success "Order Service built"

# Build Inventory Service
echo ""
print_info "Building Inventory Service..."
docker build -t inventory-service:latest backend/inventory-service
print_success "Inventory Service built"

# Build Notification Service
echo ""
print_info "Building Notification Service..."
docker build -t notification-service:latest backend/notification-service
print_success "Notification Service built"

echo ""
print_success "All images built successfully!"
echo ""

# ====================
# STEP 2: DEPLOY TO K8S
# ====================
echo "=========================================="
echo "STEP 2: Deploying to Kubernetes"
echo "=========================================="
echo ""

cd k8s/scripts

# Run deploy script
./deploy.sh --all

echo ""
echo "=========================================="
echo "Build and Deploy Complete!"
echo "=========================================="
echo ""

# Show pod status
echo "Current pod status:"
kubectl get pods -n demo-micro

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Wait for all pods to be Running (1/1)"
echo "   Check status: kubectl get pods -n demo-micro"
echo ""
echo "2. Port forward API Gateway:"
echo "   kubectl port-forward service/api-gateway 8080:8080 -n demo-micro"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:8080/health"
echo ""
echo "4. Import Postman collection:"
echo "   File: Demo-Micro-API.postman_collection.json"
echo ""

