#!/bin/bash

set -e

echo "=========================================="
echo "Undeploying Demo Micro from Kubernetes"
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

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed."
    exit 1
fi

read -p "Are you sure you want to delete all resources in demo-micro namespace? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cancelled."
    exit 0
fi

print_info "Deleting Ingress..."
kubectl delete -f k8s/ingress.yaml --ignore-not-found=true

print_info "Deleting API Gateway..."
kubectl delete -f k8s/api-gateway-deployment.yaml --ignore-not-found=true

print_info "Deleting microservices..."
kubectl delete -f k8s/order-service-deployment.yaml --ignore-not-found=true
kubectl delete -f k8s/inventory-service-deployment.yaml --ignore-not-found=true
kubectl delete -f k8s/notification-service-deployment.yaml --ignore-not-found=true

print_info "Deleting LocalStack..."
kubectl delete -f k8s/localstack-deployment.yaml --ignore-not-found=true

print_info "Deleting ELK stack..."
kubectl delete -f k8s/elk-stack.yaml --ignore-not-found=true

print_info "Deleting databases..."
kubectl delete -f k8s/order-db-statefulset.yaml --ignore-not-found=true
kubectl delete -f k8s/inventory-db-statefulset.yaml --ignore-not-found=true
kubectl delete -f k8s/mongodb-statefulset.yaml --ignore-not-found=true
kubectl delete -f k8s/redis-statefulset.yaml --ignore-not-found=true

print_info "Deleting PVCs..."
kubectl delete -f k8s/pvc.yaml --ignore-not-found=true

print_info "Deleting ConfigMaps and Secrets..."
kubectl delete -f k8s/configmap.yaml --ignore-not-found=true
kubectl delete -f k8s/secrets.yaml --ignore-not-found=true

read -p "Do you want to delete the entire namespace? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deleting namespace..."
    kubectl delete namespace demo-micro --ignore-not-found=true
fi

print_success "Cleanup completed!"
