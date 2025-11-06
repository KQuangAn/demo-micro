#!/bin/bash

# Script to check the health of all services

set -e

echo "=========================================="
echo "Health Check for Demo Micro Services"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local service_name=$1
    local namespace=$2
    
    echo -n "Checking $service_name... "
    
    local pods=$(kubectl get pods -n $namespace -l app=$service_name -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    if [ -z "$pods" ]; then
        echo -e "${RED}NOT FOUND${NC}"
        return 1
    fi
    
    local ready=true
    for pod in $pods; do
        local status=$(kubectl get pod $pod -n $namespace -o jsonpath='{.status.phase}')
        local ready_status=$(kubectl get pod $pod -n $namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [ "$status" != "Running" ] || [ "$ready_status" != "True" ]; then
            ready=false
            break
        fi
    done
    
    if [ "$ready" = true ]; then
        echo -e "${GREEN}HEALTHY${NC} ($(echo $pods | wc -w) pods)"
    else
        echo -e "${YELLOW}UNHEALTHY${NC}"
        return 1
    fi
}

check_statefulset() {
    local service_name=$1
    local namespace=$2
    
    echo -n "Checking $service_name (StatefulSet)... "
    
    local pods=$(kubectl get pods -n $namespace -l app=$service_name -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    if [ -z "$pods" ]; then
        echo -e "${RED}NOT FOUND${NC}"
        return 1
    fi
    
    local status=$(kubectl get pods -n $namespace -l app=$service_name -o jsonpath='{.items[0].status.phase}')
    local ready_status=$(kubectl get pods -n $namespace -l app=$service_name -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
    
    if [ "$status" = "Running" ] && [ "$ready_status" = "True" ]; then
        echo -e "${GREEN}HEALTHY${NC}"
    else
        echo -e "${YELLOW}UNHEALTHY${NC}"
        return 1
    fi
}

# Check namespace
echo -n "Checking namespace... "
if kubectl get namespace demo-micro &> /dev/null; then
    echo -e "${GREEN}EXISTS${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    exit 1
fi

echo ""
echo "Databases:"
check_statefulset "order-db" "demo-micro"
check_statefulset "inventory-db" "demo-micro"
check_statefulset "notification-db" "demo-micro"
check_statefulset "redis" "demo-micro"

echo ""
echo "Supporting Services:"
check_service "localstack" "demo-micro"
check_statefulset "elasticsearch" "demo-micro"
check_service "logstash" "demo-micro"
check_service "kibana" "demo-micro"

echo ""
echo "Microservices:"
check_service "api-gateway" "demo-micro"
check_service "order-service" "demo-micro"
check_service "inventory-service" "demo-micro"
check_service "notification-service" "demo-micro"

echo ""
echo "=========================================="
echo "Health Check Complete"
echo "=========================================="

# Show resource usage
echo ""
echo "Resource Usage:"
kubectl top pods -n demo-micro 2>/dev/null || echo "Metrics server not available"
