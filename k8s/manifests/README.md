# Kubernetes Manifests

This directory contains the core Kubernetes resource manifests for the demo-micro project.

## 📋 Files

### `namespace.yaml`

Creates the `demo-micro` namespace where all application resources are deployed.

**Purpose**: Logical isolation of resources
**When to modify**: When changing the namespace name

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo-micro
```

### `secrets.yaml`

Stores sensitive configuration data (passwords, connection strings, API keys).

**Purpose**: Secure storage of credentials
**When to modify**: When updating passwords or adding new secrets

**Secrets included**:

- Database passwords (PostgreSQL, MongoDB)
- Redis password
- AWS credentials (for LocalStack)

### `pvc.yaml`

Defines Persistent Volume Claims for stateful services.

**Purpose**: Durable storage for databases and stateful applications
**When to modify**: When changing storage requirements or storage class

**PVCs defined**:

- `order-db-pvc` - Order service PostgreSQL (5Gi)
- `inventory-db-pvc` - Inventory service PostgreSQL (5Gi)
- `notification-db-pvc` - Notification service MongoDB (5Gi)
- `redis-pvc` - Redis cache (2Gi)
- `elasticsearch-pvc` - Elasticsearch data (10Gi)
- `logstash-pvc` - Logstash data (5Gi)
- `kafka-pvc` - Kafka data (10Gi)
- `zookeeper-pvc` - Zookeeper data (5Gi)

### `ingress.yaml`

Configures external access to services through an Ingress controller.

**Purpose**: HTTP/HTTPS routing to services
**When to modify**: When adding new routes or changing domain names

**Routes configured**:

- `/api/*` → API Gateway
- `/orders/*` → Order Service
- `/inventory/*` → Inventory Service
- `/notifications/*` → Notification Service

## 🔧 Usage

### Apply All Manifests

```bash
kubectl apply -f k8s/manifests/
```

### Apply Individual Manifest

```bash
kubectl apply -f k8s/manifests/namespace.yaml
kubectl apply -f k8s/manifests/secrets.yaml
kubectl apply -f k8s/manifests/pvc.yaml
kubectl apply -f k8s/manifests/ingress.yaml
```

### View Resources

```bash
# View namespace
kubectl get namespace demo-micro

# View secrets
kubectl get secrets -n demo-micro

# View PVCs
kubectl get pvc -n demo-micro

# View ingress
kubectl get ingress -n demo-micro
```

### Delete Resources

```bash
# Delete specific resource
kubectl delete -f k8s/manifests/ingress.yaml

# Delete all
kubectl delete -f k8s/manifests/
```

## 🔒 Security Notes

### Secrets Management

⚠️ **Important**: The `secrets.yaml` file contains base64-encoded credentials. In production:

1. **Never commit secrets to Git**

   - Add `secrets.yaml` to `.gitignore`
   - Use template files instead

2. **Use external secret management**

   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - Sealed Secrets

3. **Rotate secrets regularly**

   - Change passwords periodically
   - Update base64-encoded values

4. **Use RBAC**
   - Restrict access to secrets
   - Use ServiceAccounts

### Encode/Decode Secrets

```bash
# Encode
echo -n "mypassword" | base64

# Decode
echo "bXlwYXNzd29yZA==" | base64 -d
```

## 📦 Dependencies

### Order of Application

These manifests should be applied in this order:

1. **namespace.yaml** - Creates the namespace first
2. **secrets.yaml** - Secrets needed by other resources
3. **pvc.yaml** - Storage must be available before pods
4. **ingress.yaml** - Applied last (after services are running)

The `deploy.sh` script handles this ordering automatically.

## 🔄 Update Workflow

### Updating Secrets

```bash
# 1. Edit secrets.yaml
nano k8s/manifests/secrets.yaml

# 2. Apply changes
kubectl apply -f k8s/manifests/secrets.yaml

# 3. Restart pods to pick up new secrets
kubectl rollout restart deployment -n demo-micro
```

### Updating PVCs

⚠️ **Warning**: PVCs cannot be resized while in use (depends on storage class)

```bash
# 1. Scale down deployments
kubectl scale deployment --all --replicas=0 -n demo-micro

# 2. Update PVC
kubectl apply -f k8s/manifests/pvc.yaml

# 3. Scale back up
kubectl scale deployment --all --replicas=1 -n demo-micro
```

### Updating Ingress

```bash
# 1. Edit ingress.yaml
nano k8s/manifests/ingress.yaml

# 2. Apply changes
kubectl apply -f k8s/manifests/ingress.yaml

# 3. Verify routes
kubectl describe ingress -n demo-micro
```

## 🔍 Troubleshooting

### Namespace Issues

```bash
# Check if namespace exists
kubectl get namespace demo-micro

# View namespace details
kubectl describe namespace demo-micro

# Delete and recreate
kubectl delete namespace demo-micro
kubectl apply -f k8s/manifests/namespace.yaml
```

### Secret Issues

```bash
# View secret names
kubectl get secrets -n demo-micro

# View secret details (without values)
kubectl describe secret <secret-name> -n demo-micro

# View secret values
kubectl get secret <secret-name> -n demo-micro -o yaml
```

### PVC Issues

```bash
# Check PVC status
kubectl get pvc -n demo-micro

# View PVC details
kubectl describe pvc <pvc-name> -n demo-micro

# Check if PV is bound
kubectl get pv

# Common states:
# - Pending: Waiting for PV
# - Bound: Successfully bound to PV
# - Lost: PV deleted
```

### Ingress Issues

```bash
# Check ingress status
kubectl get ingress -n demo-micro

# View ingress details
kubectl describe ingress demo-micro-ingress -n demo-micro

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## 📚 Learn More

- [Kubernetes Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Ingress Controllers](https://kubernetes.io/docs/concepts/services-networking/ingress/)

---

**Location**: `k8s/manifests/`
**Purpose**: Core Kubernetes resource definitions
**Dependencies**: None (these are the foundation)
