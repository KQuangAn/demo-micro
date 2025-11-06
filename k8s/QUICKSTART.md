# Demo Micro - Kubernetes Quick Start Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Minikube or Docker Desktop with Kubernetes enabled
- kubectl installed
- Docker installed

### Deploy in 3 Steps

1. **Start Kubernetes**

   ```bash
   minikube start --cpus=4 --memory=8192
   ```

2. **Build Images**

   ```bash
   cd k8s
   chmod +x build-images.sh
   ./build-images.sh
   ```

3. **Deploy**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

### Access Services

- **API Gateway**: http://localhost:30080
- **Kibana**: http://localhost:30561

### Check Status

```bash
kubectl get pods -n demo-micro
```

### View Logs

```bash
kubectl logs -f deployment/api-gateway -n demo-micro
```

### Cleanup

```bash
./undeploy.sh
```

## 📚 Full Documentation

See [k8s/README.md](./README.md) for complete documentation.

## 🛠️ Using Make

```bash
# Show all available commands
make help

# Build and deploy
make build
make deploy

# Check status
make status

# View logs
make logs

# Cleanup
make undeploy
```

## 🔧 Using Kustomize

```bash
kubectl apply -k k8s/
```

## 🚢 Using Skaffold (Development)

```bash
# Install Skaffold: https://skaffold.dev/docs/install/

# Development mode (auto-rebuild and redeploy on code changes)
skaffold dev

# One-time deployment
skaffold run

# Cleanup
skaffold delete
```

## 🌐 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Ingress / Load Balancer              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │   API Gateway    │
          │   (Port 8080)    │
          └────────┬─────────┘
                   │
      ┏━━━━━━━━━━━┻━━━━━━━━━━━━━━━━┓
      ▼            ▼                ▼
┌──────────┐ ┌──────────┐   ┌──────────────┐
│  Order   │ │Inventory │   │ Notification │
│ Service  │ │ Service  │   │   Service    │
│(Pt 9001) │ │(Pt 9000) │   │  (Pt 9002)   │
└────┬─────┘ └────┬─────┘   └──────┬───────┘
     │            │                 │
     ▼            ▼                 ▼
┌──────────┐ ┌──────────┐   ┌──────────┐
│PostgreSQL│ │PostgreSQL│   │ MongoDB  │
└──────────┘ └──────────┘   └──────────┘

Supporting Services:
├── Redis (Caching)
├── LocalStack (AWS Emulation)
└── ELK Stack (Logging)
    ├── Elasticsearch
    ├── Logstash
    └── Kibana
```

## 📊 Resource Requirements

### Development (Minimum)

- **CPU**: 4 cores
- **Memory**: 8 GB
- **Storage**: 20 GB

### Production (Recommended)

- **CPU**: 8+ cores
- **Memory**: 16+ GB
- **Storage**: 50+ GB

## 🔒 Security Notes

⚠️ **IMPORTANT**: The default secrets are for development only!

Before deploying to production:

1. Generate new secrets:

   ```bash
   echo -n "your-password" | base64
   ```

2. Update `k8s/secrets.yaml` with your values

3. Consider using a secrets management solution:
   - Sealed Secrets
   - External Secrets Operator
   - Cloud provider secret managers

## 🐛 Troubleshooting

### Pods not starting?

```bash
kubectl describe pod <pod-name> -n demo-micro
kubectl logs <pod-name> -n demo-micro
```

### Can't access services?

```bash
# Check if services are running
kubectl get svc -n demo-micro

# Use port-forward as alternative
kubectl port-forward svc/api-gateway 8080:8080 -n demo-micro
```

### Image pull errors?

```bash
# For minikube, use minikube's Docker daemon
eval $(minikube docker-env)
./build-images.sh
```

## 📖 Additional Resources

- [Kubernetes Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)

## 🤝 Contributing

Contributions are welcome! Please ensure:

- All manifests are valid YAML
- Images build successfully
- Deployments work on minikube
- Documentation is updated

## 📝 License

[Your License Here]
