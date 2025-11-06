.PHONY: help build deploy undeploy clean status logs restart scale test

# Default target
help:
	@echo "Available targets:"
	@echo "  make build       - Build all Docker images"
	@echo "  make deploy      - Deploy to Kubernetes"
	@echo "  make undeploy    - Remove all Kubernetes resources"
	@echo "  make clean       - Clean up everything including images"
	@echo "  make status      - Show status of all resources"
	@echo "  make logs        - Follow logs for all services"
	@echo "  make restart     - Restart all deployments"
	@echo "  make scale       - Scale services"
	@echo "  make test        - Test service connectivity"
	@echo "  make port-forward - Forward ports for local access"

# Build Docker images
build:
	@echo "Building Docker images..."
	@bash build-images.sh

# Deploy to Kubernetes
deploy:
	@echo "Deploying to Kubernetes..."
	@bash deploy.sh

# Undeploy from Kubernetes
undeploy:
	@echo "Undeploying from Kubernetes..."
	@bash undeploy.sh

# Clean everything
clean: undeploy
	@echo "Cleaning Docker images..."
	@docker rmi -f api-gateway:latest order-service:latest inventory-service:latest notification-service:latest 2>/dev/null || true

# Show status
status:
	@echo "=== Namespace ==="
	@kubectl get namespace demo-micro 2>/dev/null || echo "Namespace not found"
	@echo ""
	@echo "=== Pods ==="
	@kubectl get pods -n demo-micro -o wide 2>/dev/null || echo "No pods found"
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc -n demo-micro 2>/dev/null || echo "No services found"
	@echo ""
	@echo "=== Deployments ==="
	@kubectl get deployments -n demo-micro 2>/dev/null || echo "No deployments found"
	@echo ""
	@echo "=== StatefulSets ==="
	@kubectl get statefulsets -n demo-micro 2>/dev/null || echo "No statefulsets found"
	@echo ""
	@echo "=== PVCs ==="
	@kubectl get pvc -n demo-micro 2>/dev/null || echo "No PVCs found"
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n demo-micro 2>/dev/null || echo "No ingress found"

# Follow logs
logs:
	@echo "Following logs for api-gateway..."
	@kubectl logs -f -l app=api-gateway -n demo-micro --all-containers=true

# Restart all deployments
restart:
	@echo "Restarting all deployments..."
	@kubectl rollout restart deployment/api-gateway -n demo-micro
	@kubectl rollout restart deployment/order-service -n demo-micro
	@kubectl rollout restart deployment/inventory-service -n demo-micro
	@kubectl rollout restart deployment/notification-service -n demo-micro
	@kubectl rollout restart deployment/localstack -n demo-micro

# Scale services
scale:
	@echo "Scaling services..."
	@kubectl scale deployment api-gateway --replicas=3 -n demo-micro
	@kubectl scale deployment order-service --replicas=3 -n demo-micro
	@kubectl scale deployment inventory-service --replicas=3 -n demo-micro
	@kubectl scale deployment notification-service --replicas=2 -n demo-micro
	@echo "Services scaled. Use 'make status' to check."

# Test connectivity
test:
	@echo "Testing service connectivity..."
	@echo "=== Testing API Gateway ==="
	@curl -s http://localhost:30080/ || echo "API Gateway not accessible"
	@echo ""
	@echo "=== Testing Order Service (internal) ==="
	@kubectl run test-pod --rm -it --image=busybox --restart=Never -n demo-micro -- wget -O- http://order-service:9001/ 2>/dev/null || echo "Order Service not accessible"

# Port forward for local access
port-forward:
	@echo "Setting up port forwarding..."
	@echo "API Gateway: http://localhost:8080"
	@kubectl port-forward svc/api-gateway 8080:8080 -n demo-micro &
	@echo "Order Service: http://localhost:9001"
	@kubectl port-forward svc/order-service 9001:9001 -n demo-micro &
	@echo "Inventory Service: http://localhost:9000"
	@kubectl port-forward svc/inventory-service 9000:9000 -n demo-micro &
	@echo "Notification Service: http://localhost:9002"
	@kubectl port-forward svc/notification-service 9002:9002 -n demo-micro &
	@echo "Kibana: http://localhost:5601"
	@kubectl port-forward svc/kibana 5601:5601 -n demo-micro &
	@echo ""
	@echo "Port forwarding active. Press Ctrl+C to stop."

# Install dependencies (for local development)
install-deps:
	@echo "Checking dependencies..."
	@command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Aborting." >&2; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "docker is required but not installed. Aborting." >&2; exit 1; }
	@echo "All dependencies are installed."

# Minikube specific targets
minikube-start:
	@minikube start --cpus=4 --memory=8192

minikube-stop:
	@minikube stop

minikube-delete:
	@minikube delete

minikube-dashboard:
	@minikube dashboard

minikube-tunnel:
	@minikube tunnel
