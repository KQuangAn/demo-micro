#!/bin/bash

set -e

echo "=========================================="
echo "Deploying Demo Micro to Kubernetes"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
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

print_info "Creating namespace..."
kubectl apply -f k8s/namespace.yaml

print_info "Creating secrets..."
kubectl apply -f k8s/secrets.yaml

print_info "Creating ConfigMaps..."
kubectl apply -f k8s/configmap.yaml

print_info "Creating PersistentVolumeClaims..."
kubectl apply -f k8s/pvc.yaml

print_info "Deploying databases (StatefulSets)..."
kubectl apply -f k8s/order-db-statefulset.yaml
kubectl apply -f k8s/inventory-db-statefulset.yaml
kubectl apply -f k8s/mongodb-statefulset.yaml
kubectl apply -f k8s/redis-statefulset.yaml

print_info "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=order-db -n demo-micro --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=inventory-db -n demo-micro --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=notification-db -n demo-micro --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=redis -n demo-micro --timeout=300s || true

# Optional: Deploy Kafka stack
read -p "Do you want to deploy Kafka stack (Zookeeper, Kafka, Kafdrop, Schema Registry)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deploying Kafka stack..."
    kubectl apply -f k8s/kafka-stack.yaml
    
    print_info "Waiting for Zookeeper to be ready..."
    kubectl wait --for=condition=ready pod -l app=zookeeper -n demo-micro --timeout=300s || true
    
    print_info "Waiting for Kafka to be ready..."
    kubectl wait --for=condition=ready pod -l app=kafka -n demo-micro --timeout=300s || true
fi

print_info "Deploying LocalStack..."
kubectl apply -f k8s/localstack-deployment.yaml

print_info "Waiting for LocalStack to be ready..."
kubectl wait --for=condition=ready pod -l app=localstack -n demo-micro --timeout=300s || true

print_info "Deploying microservices..."
kubectl apply -f k8s/order-service-deployment.yaml
kubectl apply -f k8s/inventory-service-deployment.yaml
kubectl apply -f k8s/notification-service-deployment.yaml

print_info "Waiting for microservices to be ready..."
kubectl wait --for=condition=ready pod -l app=order-service -n demo-micro --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=inventory-service -n demo-micro --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=notification-service -n demo-micro --timeout=300s || true

print_info "Deploying API Gateway..."
kubectl apply -f k8s/api-gateway-deployment.yaml

print_info "Waiting for API Gateway to be ready..."
kubectl wait --for=condition=ready pod -l app=api-gateway -n demo-micro --timeout=300s || true

# Optional: Deploy ELK stack
read -p "Do you want to deploy ELK stack (Elasticsearch, Logstash, Kibana)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deploying ELK stack..."
    kubectl apply -f k8s/elk-stack.yaml
    
    print_info "Waiting for ELK stack to be ready..."
    kubectl wait --for=condition=ready pod -l app=elasticsearch -n demo-micro --timeout=300s || true
fi

# Optional: Deploy Ingress
read -p "Do you want to deploy Ingress controller? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Enabling Ingress addon (minikube)..."
    if command -v minikube &> /dev/null; then
        minikube addons enable ingress
    fi
    
    print_info "Deploying Ingress rules..."
    kubectl apply -f k8s/ingress.yaml
fi

print_success "Deployment completed!"

echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
kubectl get all -n demo-micro

echo ""
echo "=========================================="
echo "Access Information"
echo "=========================================="
echo "API Gateway (NodePort): http://localhost:30080"
echo "Kibana (NodePort): http://localhost:30561"
echo ""
echo "To access services via Ingress, add these entries to /etc/hosts:"
echo "  <MINIKUBE_IP> api.demo-micro.local"
echo "  <MINIKUBE_IP> kibana.demo-micro.local"
echo "  <MINIKUBE_IP> order.demo-micro.local"
echo "  <MINIKUBE_IP> inventory.demo-micro.local"
echo "  <MINIKUBE_IP> notification.demo-micro.local"
echo ""
if command -v minikube &> /dev/null; then
    echo "Minikube IP: $(minikube ip)"
fi
echo ""
echo "To view logs: kubectl logs -f <pod-name> -n demo-micro"
echo "To get pods: kubectl get pods -n demo-micro"
echo "To describe pod: kubectl describe pod <pod-name> -n demo-micro"
