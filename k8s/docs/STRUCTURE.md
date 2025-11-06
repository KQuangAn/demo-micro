# Kubernetes Structure Documentation

## Overview
This document describes the new microservices-oriented Kubernetes structure for the demo-micro project.

## Directory Structure

```
demo-micro/
├── backend/
│   ├── api-gateway/
│   │   └── k8s/
│   │       ├── deployment.yaml       # API Gateway deployment
│   │       ├── service.yaml          # API Gateway service
│   │       └── configmap.yaml        # API Gateway configuration
│   │
│   ├── order-service/
│   │   └── k8s/
│   │       ├── deployment.yaml       # Order service deployment
│   │       ├── service.yaml          # Order service
│   │       ├── configmap.yaml        # Order service configuration
│   │       └── database/
│   │           └── statefulset.yaml  # PostgreSQL for orders
│   │
│   ├── inventory-service/
│   │   └── k8s/
│   │       ├── deployment.yaml       # Inventory service deployment
│   │       ├── service.yaml          # Inventory service
│   │       ├── configmap.yaml        # Inventory service configuration
│   │       └── database/
│   │           └── statefulset.yaml  # PostgreSQL for inventory
│   │
│   └── notification-service/
│       └── k8s/
│           ├── deployment.yaml       # Notification service deployment
│           ├── service.yaml          # Notification service
│           ├── configmap.yaml        # Notification service configuration
│           └── database/
│               └── statefulset.yaml  # MongoDB for notifications
│
└── k8s/
    ├── namespace.yaml                # demo-micro namespace
    ├── secrets.yaml                  # Shared secrets
    ├── pvc.yaml                      # Persistent volume claims
    ├── ingress.yaml                  # Ingress rules
    ├── deploy.sh                     # Main deployment script
    ├── undeploy.sh                   # Cleanup script
    ├── build-images.sh               # Docker image build script
    └── infrastructure/               # Shared infrastructure services
        ├── redis/
        │   └── statefulset.yaml      # Redis cache
        ├── kafka/
        │   └── kafka-stack.yaml      # Kafka, Zookeeper, Kafdrop, Schema Registry
        ├── elk/
        │   └── elk-stack.yaml        # Elasticsearch, Logstash, Kibana
        └── localstack/
            └── deployment.yaml       # AWS LocalStack
```

## Design Principles

### 1. Service Ownership
Each microservice owns its Kubernetes manifests:
- **Benefit**: Clear ownership and responsibility
- **Benefit**: Services can be deployed independently
- **Benefit**: Version control coupling with service code

### 2. Database Co-location
Each service's database manifests are stored with the service:
- **Benefit**: Database schema and deployment are versioned together
- **Benefit**: Service teams own their data layer
- **Benefit**: Easier to understand service dependencies

### 3. Shared Infrastructure
Common infrastructure components are centralized:
- **Location**: `k8s/infrastructure/`
- **Components**: Redis, Kafka, ELK, LocalStack
- **Benefit**: Single source of truth for shared services
- **Benefit**: Easier to manage infrastructure upgrades

### 4. Global Resources
Cluster-wide resources remain at the root:
- **Resources**: Namespace, Secrets, PVCs, Ingress
- **Benefit**: Central management of cluster configuration
- **Benefit**: Easier security and access control

## Deployment Workflow

### Quick Deploy All Services
```bash
cd k8s
./deploy.sh --all
```

### Deploy with Options
```bash
# Deploy without Kafka and ELK
./deploy.sh

# Deploy with Kafka
./deploy.sh --kafka

# Deploy with ELK
./deploy.sh --elk

# Deploy everything
./deploy.sh --all
```

### Deploy Individual Service
```bash
# Deploy Order Service
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl apply -f backend/order-service/k8s/database/statefulset.yaml
kubectl apply -f backend/order-service/k8s/service.yaml
kubectl apply -f backend/order-service/k8s/deployment.yaml
```

### Deploy Infrastructure Component
```bash
# Deploy Kafka
kubectl apply -f k8s/infrastructure/kafka/kafka-stack.yaml

# Deploy Redis
kubectl apply -f k8s/infrastructure/redis/statefulset.yaml
```

## File Descriptions

### Service-Level Files

#### deployment.yaml
- Defines the Deployment resource for the microservice
- Specifies replicas, container image, ports, health probes
- References ConfigMaps and Secrets for configuration

#### service.yaml
- Defines the Kubernetes Service for internal networking
- Maps service name to pod selector
- Specifies service type (ClusterIP, NodePort, LoadBalancer)

#### configmap.yaml
- Contains environment-specific configuration
- Database URLs, service endpoints, feature flags
- Non-sensitive configuration data

#### database/statefulset.yaml
- Defines StatefulSet for databases (PostgreSQL, MongoDB)
- Includes headless service for stable network identity
- Mounts PersistentVolumeClaims for data persistence

### Root-Level Files

#### namespace.yaml
- Creates the `demo-micro` namespace
- Isolates all project resources

#### secrets.yaml
- Stores sensitive data (passwords, API keys)
- Base64 encoded values
- Referenced by pods via secretKeyRef

#### pvc.yaml
- Defines PersistentVolumeClaims for all services
- Requests storage from the cluster
- Used by StatefulSets for data persistence

#### ingress.yaml
- Defines HTTP routing rules
- Maps external URLs to internal services
- Enables TLS termination

## Best Practices

### 1. Service Development
- Keep K8s manifests in version control with service code
- Test deployment locally before pushing
- Use ConfigMaps for environment-specific values
- Never commit secrets to git (use Sealed Secrets or external secret management)

### 2. Database Management
- Use StatefulSets for databases
- Always use PersistentVolumes for data
- Include health checks and resource limits
- Consider backup and restore strategies

### 3. Configuration Management
- Use ConfigMaps for non-sensitive config
- Use Secrets for passwords and keys
- Externalize all environment-specific values
- Use consistent naming conventions

### 4. Deployment Strategy
- Deploy infrastructure first (databases, Redis, Kafka)
- Wait for databases to be ready before deploying services
- Deploy services in dependency order
- Deploy API Gateway last (depends on all services)

## Migration from Old Structure

If migrating from the old centralized structure:

1. **Backup**: Create a backup of the old k8s/ directory
2. **Deploy New**: Use the new deploy.sh script
3. **Verify**: Check all pods are running: `kubectl get pods -n demo-micro`
4. **Test**: Verify service connectivity
5. **Cleanup**: Delete old redundant files

## Troubleshooting

### Service Won't Start
```bash
# Check pod status
kubectl get pods -n demo-micro

# Check pod logs
kubectl logs -f <pod-name> -n demo-micro

# Describe pod for events
kubectl describe pod <pod-name> -n demo-micro
```

### Database Connection Issues
```bash
# Check database pod
kubectl get pods -n demo-micro | grep db

# Check database logs
kubectl logs -f <db-pod-name> -n demo-micro

# Test connection from service pod
kubectl exec -it <service-pod> -n demo-micro -- /bin/sh
# Then try: ping <database-service-name>
```

### ConfigMap Changes Not Reflected
```bash
# Restart deployment to pick up new ConfigMap
kubectl rollout restart deployment/<service-name> -n demo-micro
```

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [StatefulSet Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [ConfigMap Documentation](https://kubernetes.io/docs/concepts/configuration/configmap/)

## Contact

For questions or issues with the Kubernetes setup, please refer to the main README.md or contact the DevOps team.
