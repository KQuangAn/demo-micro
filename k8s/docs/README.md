# Kubernetes Deployment for Demo Micro

This directory contains Kubernetes manifests for deploying the microservices application to Kubernetes.

## 📁 Structure

**New in v2.0**: We've migrated to a microservices-oriented structure where each service owns its Kubernetes manifests!

```
backend/
├── api-gateway/k8s/          # API Gateway K8s files
├── order-service/k8s/        # Order Service K8s files + database
├── inventory-service/k8s/    # Inventory Service K8s files + database
└── notification-service/k8s/ # Notification Service K8s files + database

k8s/
├── namespace.yaml            # Global resources
├── secrets.yaml
├── pvc.yaml
├── ingress.yaml
├── deploy.sh                 # Main deployment script
└── infrastructure/           # Shared services
    ├── redis/
    ├── kafka/
    ├── elk/
    └── localstack/
```

📖 **See [STRUCTURE.md](./STRUCTURE.md)** for detailed documentation  
📖 **See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)** if upgrading from old structure

## Architecture

The application consists of:

### Microservices

- **API Gateway** (Port 8080) - GraphQL gateway routing requests to backend services
- **Order Service** (Port 9001) - Manages orders
- **Inventory Service** (Port 9000) - Manages inventory
- **Notification Service** (Port 9002) - Handles notifications

### Databases

- **PostgreSQL** - Two instances for Order and Inventory services
- **MongoDB** - For Notification service
- **Redis** - For caching and session management

### Supporting Services

- **LocalStack** - AWS service emulation (SQS, EventBridge)
- **Elasticsearch** - Log storage and indexing
- **Logstash** - Log processing
- **Kibana** - Log visualization

## Prerequisites

### Required

- **Kubernetes cluster** (1.19+)
  - [Minikube](https://minikube.sigs.k8s.io/docs/start/) (for local development)
  - [Kind](https://kind.sigs.k8s.io/)
  - [Docker Desktop Kubernetes](https://docs.docker.com/desktop/kubernetes/)
  - Cloud Kubernetes (EKS, GKE, AKS)
- **kubectl** (1.19+)
- **Docker** (for building images)

### Optional

- **Helm** (for managing releases)
- **Kustomize** (for configuration management)

## Quick Start

### 1. Start Kubernetes Cluster

**For Minikube:**

```bash
minikube start --cpus=4 --memory=8192
```

**For Docker Desktop:**
Enable Kubernetes in Docker Desktop settings.

### 2. Build Docker Images

```bash
# Navigate to the k8s directory
cd k8s

# Build all images
chmod +x build-images.sh
./build-images.sh
```

**Note:** If using minikube, the script will automatically use minikube's Docker daemon.

### 3. Deploy to Kubernetes

```bash
# Deploy all services (with Kafka and ELK)
chmod +x deploy.sh
./deploy.sh --all

# Or deploy without optional services
./deploy.sh

# Deploy with specific options
./deploy.sh --kafka      # Include Kafka stack
./deploy.sh --elk        # Include ELK stack
```

The script will:

1. Create the `demo-micro` namespace
2. Apply secrets and configmaps
3. Create PersistentVolumeClaims
4. Deploy databases (StatefulSets)
5. Deploy supporting services (LocalStack)
6. Deploy microservices
7. Optionally deploy ELK stack
8. Optionally configure Ingress

### 4. Verify Deployment

```bash
# Check all resources
kubectl get all -n demo-micro

# Check pods status
kubectl get pods -n demo-micro

# Check services
kubectl get svc -n demo-micro

# Check persistent volume claims
kubectl get pvc -n demo-micro
```

## Manual Deployment

If you prefer to deploy manually or deploy individual services:

### Deploy Complete Stack

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create secrets and PVCs
kubectl apply -f secrets.yaml
kubectl apply -f pvc.yaml

# 3. Deploy infrastructure
kubectl apply -f infrastructure/redis/statefulset.yaml
kubectl apply -f infrastructure/localstack/deployment.yaml
kubectl apply -f infrastructure/kafka/kafka-stack.yaml  # Optional
kubectl apply -f infrastructure/elk/elk-stack.yaml      # Optional

# 4. Deploy services with databases
kubectl apply -f backend/order-service/k8s/
kubectl apply -f backend/inventory-service/k8s/
kubectl apply -f backend/notification-service/k8s/
kubectl apply -f backend/api-gateway/k8s/

# 5. Deploy Ingress
kubectl apply -f ingress.yaml
```

### Deploy Individual Service

```bash
# Example: Deploy only Order Service
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl apply -f backend/order-service/k8s/database/statefulset.yaml
kubectl apply -f backend/order-service/k8s/service.yaml
kubectl apply -f backend/order-service/k8s/deployment.yaml
```

## Accessing Services

### Via NodePort

The following services are exposed via NodePort:

- **API Gateway**: http://localhost:30080
- **Kibana**: http://localhost:30561

For Minikube, use:

```bash
minikube service api-gateway -n demo-micro
minikube service kibana -n demo-micro
```

### Via Ingress (Recommended)

1. Enable Ingress controller:

**For Minikube:**

```bash
minikube addons enable ingress
```

**For other Kubernetes:**

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

2. Get the Ingress IP:

**For Minikube:**

```bash
minikube ip
```

**For cloud providers:**

```bash
kubectl get ingress -n demo-micro
```

3. Add entries to `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
<INGRESS_IP> api.demo-micro.local
<INGRESS_IP> kibana.demo-micro.local
<INGRESS_IP> order.demo-micro.local
<INGRESS_IP> inventory.demo-micro.local
<INGRESS_IP> notification.demo-micro.local
```

4. Access services:

- API Gateway: http://api.demo-micro.local
- Kibana: http://kibana.demo-micro.local
- Order Service: http://order.demo-micro.local
- Inventory Service: http://inventory.demo-micro.local
- Notification Service: http://notification.demo-micro.local

### Via Port Forwarding

For direct access to any service:

```bash
# API Gateway
kubectl port-forward svc/api-gateway 8080:8080 -n demo-micro

# Order Service
kubectl port-forward svc/order-service 9001:9001 -n demo-micro

# Inventory Service
kubectl port-forward svc/inventory-service 9000:9000 -n demo-micro

# Notification Service
kubectl port-forward svc/notification-service 9002:9002 -n demo-micro

# Kibana
kubectl port-forward svc/kibana 5601:5601 -n demo-micro

# Elasticsearch
kubectl port-forward svc/elasticsearch 9200:9200 -n demo-micro
```

## 📋 Working with the New Structure

### Understanding the Layout

Each service now owns its Kubernetes manifests:

- `backend/<service>/k8s/deployment.yaml` - Service deployment
- `backend/<service>/k8s/service.yaml` - Kubernetes service
- `backend/<service>/k8s/configmap.yaml` - Service configuration
- `backend/<service>/k8s/database/` - Service database (if applicable)

Shared infrastructure lives in `k8s/infrastructure/`:

- `redis/` - Redis cache
- `kafka/` - Kafka messaging (optional)
- `elk/` - Elasticsearch, Logstash, Kibana (optional)
- `localstack/` - AWS emulation

### Deploying Individual Services

```bash
# Deploy Order Service and its database
kubectl apply -f backend/order-service/k8s/

# Deploy just the Order Service (no database)
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl apply -f backend/order-service/k8s/service.yaml
kubectl apply -f backend/order-service/k8s/deployment.yaml

# Update only configuration
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl rollout restart deployment/order-service -n demo-micro
```

### Deploying Infrastructure

```bash
# Deploy Redis only
kubectl apply -f k8s/infrastructure/redis/

# Deploy Kafka stack
kubectl apply -f k8s/infrastructure/kafka/

# Deploy ELK stack
kubectl apply -f k8s/infrastructure/elk/
```

### Benefits of New Structure

✅ **Service Ownership**: Each team owns their K8s files  
✅ **Independent Deployment**: Deploy services separately  
✅ **Version Control**: K8s manifests versioned with code  
✅ **Better Organization**: Logical grouping of files  
✅ **Microservices Best Practice**: Industry-standard structure

📖 **See [STRUCTURE.md](./STRUCTURE.md)** for complete documentation

## Monitoring and Debugging

### View Logs

```bash
# Get all pods
kubectl get pods -n demo-micro

# View logs for a specific pod
kubectl logs <pod-name> -n demo-micro

# Follow logs
kubectl logs -f <pod-name> -n demo-micro

# View logs for all pods of a deployment
kubectl logs -l app=api-gateway -n demo-micro --all-containers=true
```

### Describe Resources

```bash
# Describe a pod
kubectl describe pod <pod-name> -n demo-micro

# Describe a service
kubectl describe svc <service-name> -n demo-micro

# Describe a deployment
kubectl describe deployment <deployment-name> -n demo-micro
```

### Execute Commands in Pod

```bash
# Get a shell in a pod
kubectl exec -it <pod-name> -n demo-micro -- /bin/sh

# Run a specific command
kubectl exec <pod-name> -n demo-micro -- ls -la
```

### Check Events

```bash
kubectl get events -n demo-micro --sort-by='.lastTimestamp'
```

## Scaling

### Scale Deployments

```bash
# Scale API Gateway to 3 replicas
kubectl scale deployment api-gateway --replicas=3 -n demo-micro

# Scale Order Service to 4 replicas
kubectl scale deployment order-service --replicas=4 -n demo-micro

# View current scaling
kubectl get deployments -n demo-micro
```

### Horizontal Pod Autoscaling (HPA)

```bash
# Create HPA for API Gateway
kubectl autoscale deployment api-gateway --cpu-percent=70 --min=2 --max=10 -n demo-micro

# View HPA status
kubectl get hpa -n demo-micro
```

## Configuration Management

### Update ConfigMaps

1. Edit the configmap:

```bash
kubectl edit configmap api-gateway-config -n demo-micro
```

2. Restart the deployment to pick up changes:

```bash
kubectl rollout restart deployment api-gateway -n demo-micro
```

### Update Secrets

1. Update the secret:

```bash
# From literal
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=newuser \
  --from-literal=POSTGRES_PASSWORD=newpass \
  --dry-run=client -o yaml | kubectl apply -n demo-micro -f -

# From file
kubectl create secret generic my-secret \
  --from-file=.env \
  --dry-run=client -o yaml | kubectl apply -n demo-micro -f -
```

2. Restart the affected deployments.

## Resource Requirements

### Minimum Requirements (Development)

- CPU: 4 cores
- Memory: 8 GB RAM
- Storage: 20 GB

### Recommended (Production)

- CPU: 8+ cores
- Memory: 16+ GB RAM
- Storage: 50+ GB

## Persistent Storage

The application uses PersistentVolumeClaims (PVC) for:

- PostgreSQL databases (2x 5GB)
- MongoDB (5GB)
- Redis (1GB)
- Elasticsearch (10GB)
- LocalStack (2GB)

### Storage Classes

The manifests use the `standard` storage class by default. To use a different storage class:

```bash
# List available storage classes
kubectl get storageclass

# Update PVC manifests to use your preferred storage class
kubectl edit pvc <pvc-name> -n demo-micro
```

## Backup and Restore

### Database Backups

**PostgreSQL:**

```bash
# Backup
kubectl exec <postgres-pod> -n demo-micro -- pg_dump -U postgres orders > backup.sql

# Restore
kubectl exec -i <postgres-pod> -n demo-micro -- psql -U postgres orders < backup.sql
```

**MongoDB:**

```bash
# Backup
kubectl exec <mongodb-pod> -n demo-micro -- mongodump --out /tmp/backup

# Restore
kubectl exec <mongodb-pod> -n demo-micro -- mongorestore /tmp/backup
```

## Cleanup

### Remove All Resources

```bash
# Using the script
chmod +x undeploy.sh
./undeploy.sh

# Manual cleanup
kubectl delete namespace demo-micro
```

### Remove Minikube Cluster

```bash
minikube delete
```

## Troubleshooting

### Pods Not Starting

1. Check pod status:

```bash
kubectl get pods -n demo-micro
```

2. Describe the pod:

```bash
kubectl describe pod <pod-name> -n demo-micro
```

3. Check logs:

```bash
kubectl logs <pod-name> -n demo-micro
```

### Image Pull Errors

If using minikube, ensure you're using the minikube Docker daemon:

```bash
eval $(minikube docker-env)
./build-images.sh
```

### Services Not Accessible

1. Check service endpoints:

```bash
kubectl get endpoints -n demo-micro
```

2. Check if pods are ready:

```bash
kubectl get pods -n demo-micro
```

3. Test connectivity from within the cluster:

```bash
kubectl run test --rm -it --image=busybox -n demo-micro -- wget -O- http://api-gateway:8080
```

### Persistent Volume Issues

1. Check PVC status:

```bash
kubectl get pvc -n demo-micro
```

2. Check if PVs are bound:

```bash
kubectl get pv
```

3. For minikube, ensure the hostPath provisioner is enabled:

```bash
minikube addons list | grep storage-provisioner
```

## Production Considerations

### Security

1. **Update Secrets**: Change default passwords in `secrets.yaml`
2. **Use Secret Management**: Consider using tools like:
   - [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
   - [External Secrets Operator](https://external-secrets.io/)
   - Cloud provider secret managers (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager)
3. **Network Policies**: Implement network policies to restrict pod-to-pod communication
4. **RBAC**: Configure Role-Based Access Control
5. **Pod Security Standards**: Apply pod security policies

### High Availability

1. **Multiple Replicas**: Run at least 2-3 replicas of each service
2. **Pod Anti-Affinity**: Spread pods across nodes
3. **Database Replication**: Set up master-slave replication for databases
4. **Load Balancing**: Use proper load balancer for production traffic

### Monitoring

Consider integrating:

- **Prometheus** for metrics collection
- **Grafana** for visualization
- **Jaeger** or **Zipkin** for distributed tracing
- **Fluentd** or **Fluent Bit** for log aggregation

### CI/CD Integration

Example GitLab CI/CD pipeline:

```yaml
deploy:
  stage: deploy
  script:
    - kubectl config use-context production
    - ./k8s/build-images.sh
    - ./k8s/deploy.sh
  only:
    - main
```

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review Kubernetes events and logs
3. Check service health endpoints
4. Verify network connectivity

## License

[Your License Here]
