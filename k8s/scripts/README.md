# Deployment Scripts

This directory contains automation scripts for building, deploying, and managing the Kubernetes resources.

## 📜 Scripts

### `deploy.sh` ⭐

Main deployment script for deploying all microservices to Kubernetes.

**Purpose**: Automated deployment of entire application stack
**Platform**: Linux/macOS/WSL

**Usage**:

```bash
# Deploy core services only
./k8s/scripts/deploy.sh

# Deploy with Kafka
./k8s/scripts/deploy.sh --kafka

# Deploy with ELK stack
./k8s/scripts/deploy.sh --elk

# Deploy everything
./k8s/scripts/deploy.sh --all
```

**Features**:

- ✅ Checks prerequisites (kubectl, minikube)
- ✅ Deploys in correct order (namespace → secrets → PVCs → infrastructure → databases → services)
- ✅ Waits for resources to be ready
- ✅ Optional Kafka and ELK deployment
- ✅ Colored output for better visibility
- ✅ Error handling and validation

**Deployment Order**:

1. Namespace
2. Secrets
3. Persistent Volume Claims
4. Infrastructure (Redis, LocalStack, Kafka*, ELK*)
5. Databases (PostgreSQL, MongoDB)
6. Application Services (Order, Inventory, Notification)
7. API Gateway
8. Ingress (optional)

---

### `deploy.bat`

Windows version of deploy script.

**Purpose**: Deploy from Windows Command Prompt
**Platform**: Windows

**Usage**:

```cmd
# From k8s directory
scripts\deploy.bat

# From project root
k8s\scripts\deploy.bat
```

**Note**: Less feature-rich than deploy.sh. Consider using WSL for better experience.

---

### `undeploy.sh`

Removes all deployed resources from Kubernetes.

**Purpose**: Clean up deployment, remove all resources
**Platform**: Linux/macOS/WSL

**Usage**:

```bash
# Undeploy everything
./k8s/scripts/undeploy.sh

# Confirm deletion
./k8s/scripts/undeploy.sh --force
```

**What it does**:

- Deletes all deployments in demo-micro namespace
- Deletes all statefulsets
- Deletes all services
- Deletes configmaps and secrets
- Deletes PVCs (optional)
- Deletes namespace (optional)

**Options**:

- `--keep-pvcs`: Don't delete persistent volume claims
- `--keep-namespace`: Don't delete the namespace
- `--force`: Skip confirmation prompt

---

### `build-images.sh`

Builds Docker images for all microservices.

**Purpose**: Build container images locally before deployment
**Platform**: Linux/macOS/WSL

**Usage**:

```bash
# Build all images
./k8s/scripts/build-images.sh

# Build specific service
./k8s/scripts/build-images.sh --service api-gateway

# Build and push to registry
./k8s/scripts/build-images.sh --push
```

**Services built**:

- api-gateway (Go)
- order-service (Go)
- inventory-service (Node.js)
- notification-service (Python)

**Features**:

- Detects Dockerfile locations
- Tags images appropriately
- Optional push to registry
- Build caching for faster rebuilds
- Multi-stage builds for smaller images

**Prerequisites**:

- Docker installed and running
- Sufficient disk space
- Network access (for base images)

---

### `build-images.bat`

Windows version of image build script.

**Purpose**: Build Docker images on Windows
**Platform**: Windows

**Usage**:

```cmd
scripts\build-images.bat
```

**Note**: Requires Docker Desktop on Windows.

---

### `health-check.sh`

Checks health status of all deployed services.

**Purpose**: Verify deployment health, troubleshoot issues
**Platform**: Linux/macOS/WSL

**Usage**:

```bash
# Check all services
./k8s/scripts/health-check.sh

# Continuous monitoring
watch -n 5 ./k8s/scripts/health-check.sh

# Check specific namespace
./k8s/scripts/health-check.sh demo-micro
```

**Checks performed**:

- ✅ Namespace exists
- ✅ All pods are running
- ✅ All deployments are ready
- ✅ All statefulsets are ready
- ✅ All services have endpoints
- ✅ Resource usage (CPU, memory)
- ✅ Recent events and errors

**Output**:

- 🟢 Green: Healthy
- 🟡 Yellow: Warning
- 🔴 Red: Error

---

## 🚀 Quick Start

### First Time Deployment

```bash
# 1. Build images
./k8s/scripts/build-images.sh

# 2. Deploy to Kubernetes
./k8s/scripts/deploy.sh --all

# 3. Check health
./k8s/scripts/health-check.sh
```

### Update Deployment

```bash
# 1. Rebuild changed images
./k8s/scripts/build-images.sh --service order-service

# 2. Restart deployment
kubectl rollout restart deployment order-service -n demo-micro

# 3. Verify
./k8s/scripts/health-check.sh
```

### Teardown

```bash
# Remove everything
./k8s/scripts/undeploy.sh

# Remove but keep data
./k8s/scripts/undeploy.sh --keep-pvcs
```

## 🔧 Script Configuration

### Environment Variables

Scripts respect these environment variables:

```bash
# Kubernetes namespace (default: demo-micro)
export K8S_NAMESPACE=demo-micro

# Image registry (default: local)
export IMAGE_REGISTRY=docker.io/myregistry

# Image tag (default: latest)
export IMAGE_TAG=v1.0.0

# Minikube profile (default: minikube)
export MINIKUBE_PROFILE=demo-micro-cluster
```

### Custom Configuration

Edit scripts to customize:

- Timeout values
- Resource limits
- Service ports
- Image names

## 📝 Script Development

### Adding New Script

1. Create script in `k8s/scripts/`
2. Make it executable: `chmod +x script-name.sh`
3. Add shebang: `#!/bin/bash`
4. Include error handling: `set -e`
5. Add help/usage function
6. Document in this README

### Script Template

```bash
#!/bin/bash
set -e

# Script description
# Author: Your Name
# Usage: ./script-name.sh [options]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Main script
main() {
    print_info "Starting script..."
    # Your code here
    print_success "Script completed!"
}

main "$@"
```

## 🐛 Troubleshooting

### Script Won't Run

```bash
# Make script executable
chmod +x k8s/scripts/*.sh

# Check shebang
head -n 1 k8s/scripts/deploy.sh
# Should show: #!/bin/bash

# Run with bash explicitly
bash k8s/scripts/deploy.sh
```

### Permission Denied

```bash
# Fix permissions
chmod +x k8s/scripts/*.sh

# Or run with sudo (if needed for Docker)
sudo ./k8s/scripts/build-images.sh
```

### kubectl Not Found

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

### Docker Not Running

```bash
# Start Docker
sudo systemctl start docker

# Or start Docker Desktop (on Windows/Mac)

# Verify
docker ps
```

### Minikube Issues

```bash
# Start minikube
minikube start

# Check status
minikube status

# Reset if needed
minikube delete
minikube start

# Configure for scripts
eval $(minikube docker-env)
```

## 📊 Script Output

### deploy.sh Output Example

```
[INFO] ===================================
[INFO] Deploying Demo-Micro to Kubernetes
[INFO] ===================================
[INFO] Step 1: Creating namespace...
[SUCCESS] Namespace created
[INFO] Step 2: Creating secrets...
[SUCCESS] Secrets created
[INFO] Step 3: Creating Persistent Volume Claims...
[SUCCESS] PVCs created
[INFO] Step 4: Deploying shared infrastructure...
[INFO] Deploying Redis...
[INFO] Waiting for statefulset redis to be ready...
[SUCCESS] Redis deployed
...
[SUCCESS] ===================================
[SUCCESS] Deployment completed successfully!
[SUCCESS] ===================================
[INFO] Service URLs:
[INFO]   API Gateway: http://localhost:30080
```

### health-check.sh Output Example

```
🔍 Health Check - demo-micro namespace

📦 PODS (5/5 Running)
✅ api-gateway-6c8d9f7b5-x7k2m       Running    2m
✅ order-service-7d9f8c4b6-j9h3n     Running    3m
✅ inventory-service-8e7g9d5c7-k2n4m Running    3m
✅ notification-service-9f8h6e4d8-m1p5n Running  3m
✅ redis-0                            Running    5m

🚀 DEPLOYMENTS (4/4 Ready)
✅ api-gateway             1/1
✅ order-service           1/1
✅ inventory-service       1/1
✅ notification-service    1/1

💾 STATEFULSETS (1/1 Ready)
✅ redis                   1/1

✅ All services healthy!
```

## 🔗 Related Files

- [manifests/](../manifests/) - Kubernetes manifests
- [config/](../config/) - Tool configurations
- [docs/QUICKSTART.md](../docs/QUICKSTART.md) - Quick start guide
- [docs/README.md](../docs/README.md) - Main documentation

---

**Location**: `k8s/scripts/`
**Purpose**: Deployment automation
**Languages**: Bash (Linux/macOS), Batch (Windows)
