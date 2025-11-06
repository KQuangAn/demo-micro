# Tool Configurations

This directory contains configuration files for various Kubernetes deployment and development tools.

## 🛠️ Files

### `kustomization.yaml`

Kustomize configuration for customizing Kubernetes manifests without templates.

**Purpose**: Declarative management of Kubernetes resources
**Tool**: [Kustomize](https://kustomize.io/)

**Features**:

- Overlay configurations for different environments
- Common labels and annotations
- Resource references
- ConfigMap/Secret generators
- Image tag management

**Usage**:

```bash
# Apply with kubectl
kubectl apply -k k8s/config/

# View generated manifests
kubectl kustomize k8s/config/

# Build to file
kubectl kustomize k8s/config/ > output.yaml
```

**Example Structure**:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Reference to base manifests
resources:
  - ../manifests/namespace.yaml
  - ../manifests/secrets.yaml
  - ../manifests/pvc.yaml
  - ../infrastructure/redis/

# Common labels
commonLabels:
  app: demo-micro
  managed-by: kustomize

# Name prefix
namePrefix: demo-

# Namespace
namespace: demo-micro
```

**When to use**:

- Different configurations per environment (dev, staging, prod)
- Need to modify manifests without changing originals
- Want to manage related resources together
- Templating is too complex for your needs

---

### `skaffold.yaml`

Skaffold configuration for continuous development workflow.

**Purpose**: Automated build, push, and deploy pipeline for local development
**Tool**: [Skaffold](https://skaffold.dev/)

**Features**:

- Auto-rebuild on code changes
- Fast local development loop
- Hot reload for services
- Port forwarding
- Log streaming
- Multi-service coordination

**Usage**:

```bash
# Development mode (auto-rebuild and redeploy)
skaffold dev -f k8s/config/skaffold.yaml

# Build once and deploy
skaffold run -f k8s/config/skaffold.yaml

# Delete deployments
skaffold delete -f k8s/config/skaffold.yaml

# Build images only
skaffold build -f k8s/config/skaffold.yaml
```

**Example Structure**:

```yaml
apiVersion: skaffold/v4beta6
kind: Config

# Build configuration
build:
  artifacts:
    - image: api-gateway
      context: ../backend/api-gateway
      docker:
        dockerfile: Dockerfile
    - image: order-service
      context: ../backend/order-service
      docker:
        dockerfile: Dockerfile

# Deploy configuration
deploy:
  kubectl:
    manifests:
      - ../manifests/*.yaml
      - ../backend/*/k8s/*.yaml

# Port forwarding
portForward:
  - resourceType: service
    resourceName: api-gateway
    port: 8080
    localPort: 30080
```

**When to use**:

- Active development with frequent code changes
- Testing changes locally before push
- Need fast feedback loop
- Want to test full stack locally

---

### `Makefile`

Make targets for common Kubernetes operations.

**Purpose**: Simplified command execution
**Tool**: [GNU Make](https://www.gnu.org/software/make/)

**Usage**:

```bash
# Show available targets
make help

# Deploy everything
make deploy

# Deploy with Kafka and ELK
make deploy-all

# Build images
make build

# Run tests
make test

# Clean up
make clean

# Check health
make health
```

**Example Targets**:

```makefile
.PHONY: help deploy build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

deploy: ## Deploy core services
	./scripts/deploy.sh

deploy-all: ## Deploy with Kafka and ELK
	./scripts/deploy.sh --all

build: ## Build Docker images
	./scripts/build-images.sh

health: ## Check deployment health
	./scripts/health-check.sh

clean: ## Remove all resources
	./scripts/undeploy.sh

test: ## Run tests
	@echo "Running tests..."
	# Add test commands
```

**When to use**:

- Want simple, memorable commands
- Have complex multi-step operations
- Need to document common workflows
- Team members prefer `make` commands

---

## 🔧 Configuration Guide

### Kustomize

#### Creating Overlays

```bash
# Directory structure
k8s/config/
├── base/
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

#### Example Overlay (dev)

```yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

# Dev-specific settings
replicas:
  - name: api-gateway
    count: 1

images:
  - name: api-gateway
    newTag: dev

configMapGenerator:
  - name: env-config
    literals:
      - ENV=development
      - DEBUG=true
```

#### Apply Overlay

```bash
kubectl apply -k k8s/config/overlays/dev/
```

---

### Skaffold

#### File Sync for Hot Reload

```yaml
build:
  artifacts:
    - image: inventory-service
      context: ../backend/inventory-service
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: 'src/**/*.ts'
            dest: /app/src/
```

#### Profiles for Environments

```yaml
profiles:
  - name: dev
    activation:
      - env: ENV=dev
    build:
      artifacts:
        - image: api-gateway
          docker:
            target: development

  - name: prod
    build:
      artifacts:
        - image: api-gateway
          docker:
            target: production
```

#### Use Profile

```bash
skaffold dev -p dev
skaffold run -p prod
```

---

### Makefile

#### Advanced Targets

```makefile
# Variables
NAMESPACE := demo-micro
CONTEXT := minikube

# Phony targets
.PHONY: all deploy build test clean help

all: build deploy ## Build and deploy

deploy: ## Deploy to Kubernetes
	@echo "Deploying to $(NAMESPACE)..."
	kubectl config use-context $(CONTEXT)
	./scripts/deploy.sh --all

build: ## Build all images
	@echo "Building images..."
	eval $$(minikube docker-env) && ./scripts/build-images.sh

test: ## Run integration tests
	@echo "Running tests..."
	kubectl run test-pod --rm -it --image=curlimages/curl:latest \
		--restart=Never -- curl http://api-gateway:8080/health

clean: undeploy ## Clean everything
	@echo "Cleaning up..."
	docker system prune -f

undeploy: ## Remove from Kubernetes
	./scripts/undeploy.sh --force

health: ## Check health
	./scripts/health-check.sh

logs: ## Tail logs
	kubectl logs -f -l app=api-gateway -n $(NAMESPACE)

status: ## Show status
	kubectl get all -n $(NAMESPACE)

port-forward: ## Forward API Gateway port
	kubectl port-forward svc/api-gateway 8080:8080 -n $(NAMESPACE)
```

---

## 🚀 Quick Start

### Using Kustomize

```bash
# 1. Review configuration
kubectl kustomize k8s/config/

# 2. Apply
kubectl apply -k k8s/config/

# 3. Verify
kubectl get all -n demo-micro
```

### Using Skaffold

```bash
# 1. Start development mode
skaffold dev -f k8s/config/skaffold.yaml

# 2. Make code changes
# Skaffold will auto-rebuild and redeploy

# 3. Stop with Ctrl+C
# Skaffold will clean up automatically
```

### Using Makefile

```bash
# 1. View available commands
make help

# 2. Build and deploy
make build
make deploy

# 3. Check status
make health
make status

# 4. Clean up
make clean
```

---

## 🔄 Workflows

### Development Workflow (Skaffold)

```bash
# Terminal 1: Start Skaffold
skaffold dev

# Terminal 2: Make changes
# Skaffold automatically rebuilds and deploys

# Terminal 3: Test
curl http://localhost:30080/api/health

# Stop: Ctrl+C in Terminal 1
```

### Environment Management (Kustomize)

```bash
# Deploy to dev
kubectl apply -k k8s/config/overlays/dev/

# Deploy to staging
kubectl apply -k k8s/config/overlays/staging/

# Deploy to prod
kubectl apply -k k8s/config/overlays/prod/
```

### CI/CD Integration (Make + Scripts)

```bash
# In CI pipeline
make build
make test
make deploy

# Or directly
./k8s/scripts/build-images.sh --push
./k8s/scripts/deploy.sh --all
./k8s/scripts/health-check.sh
```

---

## 🐛 Troubleshooting

### Kustomize Issues

```bash
# Validate kustomization
kubectl kustomize k8s/config/

# Common errors:
# - Invalid YAML syntax
# - Missing resource files
# - Incorrect paths

# Debug
kubectl kustomize k8s/config/ --enable-alpha-plugins --load-restrictor LoadRestrictionsNone
```

### Skaffold Issues

```bash
# Check Skaffold version
skaffold version

# Validate config
skaffold diagnose -f k8s/config/skaffold.yaml

# Clean cache
skaffold delete
rm -rf ~/.skaffold/

# Common issues:
# - Docker daemon not accessible
# - Context not set correctly
# - Port conflicts
```

### Makefile Issues

```bash
# Check make version
make --version

# Run with debugging
make -d deploy

# Common issues:
# - Tab vs spaces (Makefiles require tabs!)
# - Missing dependencies
# - Shell command errors
```

---

## 📚 Learn More

### Kustomize

- [Official Documentation](https://kustomize.io/)
- [Kubectl Book](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/)
- [Examples](https://github.com/kubernetes-sigs/kustomize/tree/master/examples)

### Skaffold

- [Official Documentation](https://skaffold.dev/docs/)
- [Quickstart](https://skaffold.dev/docs/quickstart/)
- [Examples](https://github.com/GoogleContainerTools/skaffold/tree/main/examples)

### Make

- [GNU Make Manual](https://www.gnu.org/software/make/manual/)
- [Makefile Tutorial](https://makefiletutorial.com/)
- [Advanced Make](https://www.oreilly.com/library/view/managing-projects-with/0596006101/)

---

## 🎯 Best Practices

### Kustomize

- ✅ Use overlays for environment-specific config
- ✅ Keep base resources simple
- ✅ Use patches for minor changes
- ✅ Generate ConfigMaps/Secrets from files
- ❌ Don't overcomplicate with too many layers

### Skaffold

- ✅ Use file sync for fast iteration
- ✅ Configure port forwarding for services
- ✅ Use profiles for different scenarios
- ✅ Leverage build caching
- ❌ Don't use in production (dev tool only)

### Makefile

- ✅ Use .PHONY for non-file targets
- ✅ Add help target with descriptions
- ✅ Use variables for flexibility
- ✅ Keep targets simple and focused
- ❌ Don't put complex logic in Makefile (use scripts)

---

**Location**: `k8s/config/`
**Purpose**: Tool configurations for deployment workflows
**Tools**: Kustomize, Skaffold, Make
