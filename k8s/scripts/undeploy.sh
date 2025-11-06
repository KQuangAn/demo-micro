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

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$K8S_DIR")"

print_info "Deleting Ingress..."
kubectl delete -f "$K8S_DIR/manifests/ingress.yaml" --ignore-not-found=true 2>/dev/null

print_info "Deleting API Gateway..."
kubectl delete -f "$ROOT_DIR/backend/api-gateway/k8s/" --ignore-not-found=true 2>/dev/null

print_info "Deleting microservices..."
kubectl delete -f "$ROOT_DIR/backend/order-service/k8s/deployment.yaml" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/order-service/k8s/service.yaml" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/inventory-service/k8s/deployment.yaml" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/inventory-service/k8s/service.yaml" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/notification-service/k8s/deployment.yaml" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/notification-service/k8s/service.yaml" --ignore-not-found=true 2>/dev/null

print_info "Deleting databases..."
kubectl delete -f "$ROOT_DIR/backend/order-service/k8s/database/" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/inventory-service/k8s/database/" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$ROOT_DIR/backend/notification-service/k8s/database/" --ignore-not-found=true 2>/dev/null

print_info "Deleting infrastructure..."
kubectl delete -f "$K8S_DIR/infrastructure/elk/" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$K8S_DIR/infrastructure/kafka/" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$K8S_DIR/infrastructure/localstack/" --ignore-not-found=true 2>/dev/null
kubectl delete -f "$K8S_DIR/infrastructure/redis/" --ignore-not-found=true 2>/dev/null

print_info "Deleting PVCs..."
kubectl delete -f "$K8S_DIR/manifests/pvc.yaml" --ignore-not-found=true 2>/dev/null

print_info "Deleting ConfigMaps and Secrets..."
kubectl delete -f "$K8S_DIR/manifests/secrets.yaml" --ignore-not-found=true 2>/dev/null

read -p "Do you want to delete the entire namespace? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deleting namespace..."
    kubectl delete namespace demo-micro --ignore-not-found=true
fi

print_success "Cleanup completed!"
