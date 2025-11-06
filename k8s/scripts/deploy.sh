#!/bin/bash

# Microservices K8s Deployment Script
# Updated for reorganized structure with manifests/, scripts/, docs/, config/

set -e

# Get the script directory and set paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$K8S_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if minikube is running
if command -v minikube &> /dev/null; then
    if ! minikube status &> /dev/null; then
        print_info "Starting minikube..."
        minikube start
    fi
fi

echo ""
echo "=========================================="
echo "Deploying Demo Micro to Kubernetes"
echo "=========================================="
echo ""

# Parse command line arguments
DEPLOY_KAFKA=false
DEPLOY_ELK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --kafka)
            DEPLOY_KAFKA=true
            shift
            ;;
        --elk)
            DEPLOY_ELK=true
            shift
            ;;
        --all)
            DEPLOY_KAFKA=true
            DEPLOY_ELK=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --kafka    Deploy Kafka stack"
            echo "  --elk      Deploy ELK stack"
            echo "  --all      Deploy everything (Kafka + ELK)"
            echo "  -h, --help Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Usage: $0 [--kafka] [--elk] [--all] [-h|--help]"
            exit 1
            ;;
    esac
done

# Step 1: Create namespace
print_info "Step 1: Creating namespace..."
kubectl apply -f "$K8S_DIR/manifests/namespace.yaml"
print_success "Namespace created"

# Step 2: Create secrets
print_info "Step 2: Creating secrets..."
kubectl apply -f "$K8S_DIR/manifests/secrets.yaml"
print_success "Secrets created"

# Step 3: Create PVCs
print_info "Step 3: Creating Persistent Volume Claims..."
kubectl apply -f "$K8S_DIR/manifests/pvc.yaml"
print_success "PVCs created"

# Step 4: Deploy shared infrastructure
print_info "Step 4: Deploying shared infrastructure..."

# Deploy Redis
print_info "  → Deploying Redis..."
kubectl apply -f "$K8S_DIR/infrastructure/redis/"
kubectl wait --for=condition=ready pod -l app=redis -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ Redis deployed"

# Deploy LocalStack
print_info "  → Deploying LocalStack..."
kubectl apply -f "$K8S_DIR/infrastructure/localstack/"
kubectl wait --for=condition=ready pod -l app=localstack -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ LocalStack deployed"

# Deploy Kafka if requested
if [ "$DEPLOY_KAFKA" = true ]; then
    print_info "  → Deploying Kafka stack..."
    kubectl apply -f "$K8S_DIR/infrastructure/kafka/kafka-stack.yaml"
    kubectl wait --for=condition=ready pod -l app=zookeeper -n demo-micro --timeout=180s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=kafka -n demo-micro --timeout=180s 2>/dev/null || true
    print_success "  ✓ Kafka stack deployed"
fi

# Deploy ELK if requested
if [ "$DEPLOY_ELK" = true ]; then
    print_info "  → Deploying ELK stack..."
    kubectl apply -f "$K8S_DIR/infrastructure/elk/elk-stack.yaml"
    kubectl wait --for=condition=ready pod -l app=elasticsearch -n demo-micro --timeout=180s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=logstash -n demo-micro --timeout=120s 2>/dev/null || true
    kubectl wait --for=condition=ready pod -l app=kibana -n demo-micro --timeout=120s 2>/dev/null || true
    print_success "  ✓ ELK stack deployed"
fi

# Step 5: Deploy databases
print_info "Step 5: Deploying databases..."

# Order Service Database
print_info "  → Deploying Order database..."
kubectl apply -f "$ROOT_DIR/backend/order-service/k8s/database/"
kubectl wait --for=condition=ready pod -l app=order-db -n demo-micro --timeout=180s 2>/dev/null || true
print_success "  ✓ Order database deployed"

# Inventory Service Database
print_info "  → Deploying Inventory database..."
kubectl apply -f "$ROOT_DIR/backend/inventory-service/k8s/database/"
kubectl wait --for=condition=ready pod -l app=inventory-db -n demo-micro --timeout=180s 2>/dev/null || true
print_success "  ✓ Inventory database deployed"

# Notification Service Database
print_info "  → Deploying Notification database..."
kubectl apply -f "$ROOT_DIR/backend/notification-service/k8s/database/"
kubectl wait --for=condition=ready pod -l app=notification-db -n demo-micro --timeout=180s 2>/dev/null || true
print_success "  ✓ Notification database deployed"

# Step 6: Deploy microservices
print_info "Step 6: Deploying microservices..."

# Deploy Order Service
print_info "  → Deploying Order Service..."
kubectl apply -f "$ROOT_DIR/backend/order-service/k8s/configmap.yaml" 2>/dev/null || true
kubectl apply -f "$ROOT_DIR/backend/order-service/k8s/service.yaml"
kubectl apply -f "$ROOT_DIR/backend/order-service/k8s/deployment.yaml"
kubectl wait --for=condition=ready pod -l app=order-service -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ Order Service deployed"

# Deploy Inventory Service
print_info "  → Deploying Inventory Service..."
kubectl apply -f "$ROOT_DIR/backend/inventory-service/k8s/configmap.yaml" 2>/dev/null || true
kubectl apply -f "$ROOT_DIR/backend/inventory-service/k8s/service.yaml"
kubectl apply -f "$ROOT_DIR/backend/inventory-service/k8s/deployment.yaml"
kubectl wait --for=condition=ready pod -l app=inventory-service -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ Inventory Service deployed"

# Deploy Notification Service
print_info "  → Deploying Notification Service..."
kubectl apply -f "$ROOT_DIR/backend/notification-service/k8s/configmap.yaml" 2>/dev/null || true
kubectl apply -f "$ROOT_DIR/backend/notification-service/k8s/service.yaml"
kubectl apply -f "$ROOT_DIR/backend/notification-service/k8s/deployment.yaml"
kubectl wait --for=condition=ready pod -l app=notification-service -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ Notification Service deployed"

# Deploy API Gateway (last, as it depends on other services)
print_info "  → Deploying API Gateway..."
kubectl apply -f "$ROOT_DIR/backend/api-gateway/k8s/configmap.yaml" 2>/dev/null || true
kubectl apply -f "$ROOT_DIR/backend/api-gateway/k8s/service.yaml"
kubectl apply -f "$ROOT_DIR/backend/api-gateway/k8s/deployment.yaml"
kubectl wait --for=condition=ready pod -l app=api-gateway -n demo-micro --timeout=120s 2>/dev/null || true
print_success "  ✓ API Gateway deployed"

# Step 7: Deploy Ingress (if exists)
if [ -f "$K8S_DIR/manifests/ingress.yaml" ]; then
    print_info "Step 7: Deploying Ingress..."
    kubectl apply -f "$K8S_DIR/manifests/ingress.yaml"
    print_success "Ingress deployed"
fi

# Print deployment summary
echo ""
print_success "==================================="
print_success "  Deployment Completed!"
print_success "==================================="
echo ""
print_info "Service URLs:"
print_info "  → API Gateway: http://localhost:30080"
if [ "$DEPLOY_KAFKA" = true ]; then
    print_info "  → Kafdrop (Kafka UI): http://localhost:30900"
fi
if [ "$DEPLOY_ELK" = true ]; then
    print_info "  → Kibana: http://localhost:30561"
fi
echo ""
print_info "Useful Commands:"
print_info "  → View all resources:  kubectl get all -n demo-micro"
print_info "  → View pods:           kubectl get pods -n demo-micro"
print_info "  → View logs:           kubectl logs -f <pod-name> -n demo-micro"
print_info "  → Run health check:    ./k8s/scripts/health-check.sh"
echo ""

