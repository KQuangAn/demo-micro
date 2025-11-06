# Kubernetes vs Docker Compose - Deployment Guide

## Overview

This document compares Docker Compose and Kubernetes deployments for the Demo Micro project.

## Quick Comparison

| Feature                 | Docker Compose        | Kubernetes             |
| ----------------------- | --------------------- | ---------------------- |
| **Deployment Time**     | ~2 minutes            | ~5-10 minutes          |
| **Complexity**          | Low                   | Medium-High            |
| **Scalability**         | Limited (single host) | Excellent (multi-node) |
| **High Availability**   | No                    | Yes                    |
| **Production Ready**    | Development only      | Yes                    |
| **Auto-healing**        | Limited               | Yes                    |
| **Load Balancing**      | Basic                 | Advanced               |
| **Resource Management** | Manual                | Automatic              |
| **Rolling Updates**     | No                    | Yes                    |
| **Resource Limits**     | Basic                 | Advanced               |

## When to Use Each

### Use Docker Compose When:

- ✅ Local development
- ✅ Testing and debugging
- ✅ Simple demonstrations
- ✅ Single-machine deployments
- ✅ Quick prototyping

### Use Kubernetes When:

- ✅ Production deployments
- ✅ Multi-environment setups
- ✅ Need auto-scaling
- ✅ High availability required
- ✅ Complex orchestration
- ✅ Enterprise deployments

## Deployment Commands Comparison

### Docker Compose

**Start all services:**

```bash
docker-compose up -d
```

**Stop all services:**

```bash
docker-compose down
```

**View logs:**

```bash
docker-compose logs -f
```

**Scale a service:**

```bash
docker-compose up -d --scale api-gateway=3
```

**Rebuild:**

```bash
docker-compose up -d --build
```

### Kubernetes

**Deploy all services:**

```bash
cd k8s
./build-images.sh
./deploy.sh
```

**Or using kubectl:**

```bash
kubectl apply -k k8s/
```

**Or using Skaffold:**

```bash
skaffold run
```

**Stop all services:**

```bash
./undeploy.sh
```

**Or:**

```bash
kubectl delete namespace demo-micro
```

**View logs:**

```bash
kubectl logs -f deployment/api-gateway -n demo-micro
```

**Scale a service:**

```bash
kubectl scale deployment api-gateway --replicas=3 -n demo-micro
```

**Update deployment:**

```bash
kubectl rollout restart deployment/api-gateway -n demo-micro
```

## Architecture Differences

### Docker Compose Architecture

```
┌─────────────────────────────────────────┐
│         Single Docker Host              │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ Service  │  │ Service  │           │
│  │    A     │  │    B     │           │
│  └──────────┘  └──────────┘           │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │Database  │  │  Redis   │           │
│  └──────────┘  └──────────┘           │
│                                         │
│        Bridge Network                   │
└─────────────────────────────────────────┘
```

### Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                      │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │   Node 1   │  │   Node 2   │  │   Node 3   │       │
│  │            │  │            │  │            │       │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │       │
│  │ │  Pod   │ │  │ │  Pod   │ │  │ │  Pod   │ │       │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │       │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │       │
│  │ │  Pod   │ │  │ │  Pod   │ │  │ │  Pod   │ │       │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │       │
│  └────────────┘  └────────────┘  └────────────┘       │
│                                                          │
│         Service Discovery & Load Balancing              │
│              Persistent Storage Layer                    │
└─────────────────────────────────────────────────────────┘
```

## Feature Breakdown

### Service Discovery

**Docker Compose:**

- Services accessible by service name
- DNS resolution via Docker network
- Limited to single host

**Kubernetes:**

- Services accessible via Service objects
- Built-in DNS (CoreDNS)
- Cross-node service discovery
- External load balancer integration

### Storage

**Docker Compose:**

```yaml
volumes:
  db-data:
    driver: local
```

- Named volumes
- Bind mounts
- Single host only

**Kubernetes:**

```yaml
persistentVolumeClaim:
  claimName: db-pvc
```

- PersistentVolumes (PV)
- PersistentVolumeClaims (PVC)
- Multiple storage classes
- Network storage support
- Cross-node access

### Configuration Management

**Docker Compose:**

```yaml
environment:
  - DATABASE_URL=postgres://...
env_file:
  - .env
```

- Environment variables
- .env files
- Limited secrets management

**Kubernetes:**

```yaml
envFrom:
  - configMapRef:
      name: app-config
  - secretRef:
      name: app-secrets
```

- ConfigMaps for configuration
- Secrets for sensitive data
- Environment variables
- Mounted files
- Hot-reload support

### Networking

**Docker Compose:**

```yaml
networks:
  app-network:
    driver: bridge
```

- Bridge networks
- Host networks
- Port mapping

**Kubernetes:**

```yaml
apiVersion: v1
kind: Service
spec:
  type: ClusterIP/NodePort/LoadBalancer
```

- ClusterIP (internal)
- NodePort (external)
- LoadBalancer (cloud)
- Ingress (HTTP routing)
- Network policies

### Health Checks

**Docker Compose:**

```yaml
healthcheck:
  test: ['CMD', 'curl', 'http://localhost/health']
  interval: 30s
  timeout: 10s
  retries: 3
```

**Kubernetes:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 20
```

### Scaling

**Docker Compose:**

```bash
# Manual scaling
docker-compose up -d --scale api-gateway=3
```

- Manual scaling only
- Single host limitation
- No auto-scaling

**Kubernetes:**

```bash
# Manual scaling
kubectl scale deployment api-gateway --replicas=5

# Auto-scaling
kubectl autoscale deployment api-gateway \
  --cpu-percent=70 --min=2 --max=10
```

- Manual scaling
- Horizontal Pod Autoscaling (HPA)
- Vertical Pod Autoscaling (VPA)
- Cluster Autoscaling

### Rolling Updates

**Docker Compose:**

- No built-in rolling updates
- Requires manual orchestration
- Potential downtime

**Kubernetes:**

```bash
kubectl set image deployment/api-gateway \
  api-gateway=api-gateway:v2

kubectl rollout status deployment/api-gateway
kubectl rollout undo deployment/api-gateway
```

- Zero-downtime deployments
- Automatic rollback on failure
- Canary deployments
- Blue-green deployments

## Resource Requirements

### Docker Compose

- **Minimum**: 4GB RAM, 2 CPU cores
- **Recommended**: 8GB RAM, 4 CPU cores
- Single machine

### Kubernetes (Minikube)

- **Minimum**: 8GB RAM, 4 CPU cores
- **Recommended**: 16GB RAM, 8 CPU cores
- Can span multiple machines in production

## Monitoring & Logging

### Docker Compose

```bash
# View logs
docker-compose logs -f service-name

# Resource usage
docker stats
```

- Basic logging
- Limited metrics
- No built-in monitoring

### Kubernetes

```bash
# View logs
kubectl logs -f deployment/api-gateway

# Resource usage
kubectl top pods
kubectl top nodes

# Events
kubectl get events
```

- Centralized logging (ELK, Fluentd)
- Prometheus for metrics
- Grafana for visualization
- Distributed tracing (Jaeger)

## Cost Comparison

### Development Environment

| Item           | Docker Compose | Kubernetes |
| -------------- | -------------- | ---------- |
| Local Machine  | Free           | Free       |
| Learning Curve | 1 week         | 2-4 weeks  |
| Setup Time     | 30 minutes     | 2-4 hours  |
| Maintenance    | Low            | Medium     |

### Production Environment

| Item            | Docker Compose | Kubernetes      |
| --------------- | -------------- | --------------- |
| Infrastructure  | $50-200/month  | $200-1000/month |
| Managed Service | N/A            | $150-500/month  |
| Operations Team | 0.5 FTE        | 1-2 FTE         |
| Training        | Minimal        | Moderate        |

## Migration Path

### From Docker Compose to Kubernetes

1. **Use Kompose (Quick Start)**

   ```bash
   kompose convert -f docker-compose.yaml
   ```

   - Automatic conversion
   - May need manual adjustments

2. **Manual Migration (Recommended)**

   - Convert services to Deployments
   - Create ConfigMaps and Secrets
   - Set up proper networking
   - Configure persistent storage
   - Add health checks
   - Implement monitoring

3. **Hybrid Approach**
   - Keep Docker Compose for local dev
   - Use Kubernetes for staging/production
   - Use Skaffold to bridge both

## Best Practices

### Docker Compose

- Keep for local development
- Use .env files for configuration
- Version your docker-compose.yaml
- Document port mappings

### Kubernetes

- Use namespaces for isolation
- Implement resource limits
- Use ConfigMaps and Secrets
- Set up proper RBAC
- Enable network policies
- Implement monitoring
- Use Helm charts for complex apps
- Version your manifests

## Conclusion

**For Development**: Use Docker Compose

- Faster iteration
- Simpler setup
- Lower resource usage
- Easier debugging

**For Production**: Use Kubernetes

- Better scalability
- High availability
- Auto-healing
- Enterprise features
- Production-grade orchestration

**Recommended Workflow**:

```
Development → Docker Compose
Testing     → Kubernetes (Minikube/Kind)
Staging     → Kubernetes
Production  → Kubernetes
```
