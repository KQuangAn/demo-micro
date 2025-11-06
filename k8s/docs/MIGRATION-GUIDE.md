# Kubernetes Structure Migration Guide

## Overview
This guide explains the migration from the old centralized Kubernetes structure to the new microservices-oriented structure.

## What Changed?

### Old Structure (Centralized)
```
k8s/
├── namespace.yaml
├── secrets.yaml
├── configmap.yaml                    # All configs in one file
├── pvc.yaml
├── api-gateway-deployment.yaml       # All deployments at root
├── order-service-deployment.yaml
├── inventory-service-deployment.yaml
├── notification-service-deployment.yaml
├── order-db-statefulset.yaml
├── inventory-db-statefulset.yaml
├── mongodb-statefulset.yaml
├── redis-statefulset.yaml
├── kafka-stack.yaml
├── elk-stack.yaml
├── localstack-deployment.yaml
└── ingress.yaml
```

### New Structure (Distributed)
```
backend/
├── api-gateway/k8s/              # Service owns its manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── order-service/k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── database/
│       └── statefulset.yaml      # Database with service
├── inventory-service/k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── database/
│       └── statefulset.yaml
└── notification-service/k8s/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    └── database/
        └── statefulset.yaml

k8s/
├── namespace.yaml                # Global resources stay
├── secrets.yaml
├── pvc.yaml
├── ingress.yaml
└── infrastructure/               # Shared infrastructure
    ├── redis/
    ├── kafka/
    ├── elk/
    └── localstack/
```

## Why Migrate?

### Benefits of New Structure

1. **Clear Ownership**
   - Each service team owns their K8s manifests
   - No confusion about where files belong
   - Easier to assign responsibility

2. **Independent Deployment**
   - Services can be deployed independently
   - No need to deploy entire system for one change
   - Faster iteration and testing

3. **Version Control Alignment**
   - K8s manifests versioned with service code
   - Changes to service and deployment tracked together
   - Easier rollback and history tracking

4. **Better Organization**
   - Logical grouping of related files
   - Easier to find and modify configurations
   - Reduced file clutter at root

5. **Microservices Best Practice**
   - Follows industry standard patterns
   - Aligns with service mesh and GitOps approaches
   - Easier to scale and maintain

## Migration Steps

### Step 1: Backup Current State
```bash
# Backup current K8s state
kubectl get all -n demo-micro -o yaml > k8s-backup.yaml

# Backup old structure
cp -r k8s k8s-old-backup
```

### Step 2: Verify New Structure
```bash
# Check that new files exist
ls backend/api-gateway/k8s/
ls backend/order-service/k8s/
ls backend/inventory-service/k8s/
ls backend/notification-service/k8s/
ls k8s/infrastructure/
```

### Step 3: Undeploy Old Stack (Optional)
```bash
cd k8s
./undeploy.sh

# Or manually delete namespace
kubectl delete namespace demo-micro
```

### Step 4: Deploy New Structure
```bash
cd k8s

# Deploy everything
./deploy.sh --all

# Or deploy selectively
./deploy.sh --kafka --elk
```

### Step 5: Verify Deployment
```bash
# Check all pods are running
kubectl get pods -n demo-micro

# Check services
kubectl get svc -n demo-micro

# Check endpoints
kubectl get endpoints -n demo-micro
```

### Step 6: Test Services
```bash
# Test API Gateway
curl http://localhost:30080

# Check pod logs
kubectl logs -f deployment/api-gateway -n demo-micro
kubectl logs -f deployment/order-service -n demo-micro
kubectl logs -f deployment/inventory-service -n demo-micro
kubectl logs -f deployment/notification-service -n demo-micro
```

### Step 7: Clean Up Old Files
```bash
# Remove old backup if everything works
rm -rf k8s-old-backup
rm k8s-backup.yaml
```

## File Mapping

### Service Deployments
| Old File | New Location |
|----------|-------------|
| `k8s/api-gateway-deployment.yaml` | `backend/api-gateway/k8s/deployment.yaml` + `service.yaml` |
| `k8s/order-service-deployment.yaml` | `backend/order-service/k8s/deployment.yaml` + `service.yaml` |
| `k8s/inventory-service-deployment.yaml` | `backend/inventory-service/k8s/deployment.yaml` + `service.yaml` |
| `k8s/notification-service-deployment.yaml` | `backend/notification-service/k8s/deployment.yaml` + `service.yaml` |

### Databases
| Old File | New Location |
|----------|-------------|
| `k8s/order-db-statefulset.yaml` | `backend/order-service/k8s/database/statefulset.yaml` |
| `k8s/inventory-db-statefulset.yaml` | `backend/inventory-service/k8s/database/statefulset.yaml` |
| `k8s/mongodb-statefulset.yaml` | `backend/notification-service/k8s/database/statefulset.yaml` |

### Infrastructure
| Old File | New Location |
|----------|-------------|
| `k8s/redis-statefulset.yaml` | `k8s/infrastructure/redis/statefulset.yaml` |
| `k8s/kafka-stack.yaml` | `k8s/infrastructure/kafka/kafka-stack.yaml` |
| `k8s/elk-stack.yaml` | `k8s/infrastructure/elk/elk-stack.yaml` |
| `k8s/localstack-deployment.yaml` | `k8s/infrastructure/localstack/deployment.yaml` |

### ConfigMaps
| Old File | New Location |
|----------|-------------|
| `k8s/configmap.yaml` (api-gateway section) | `backend/api-gateway/k8s/configmap.yaml` |
| `k8s/configmap.yaml` (order-service section) | `backend/order-service/k8s/configmap.yaml` |
| `k8s/configmap.yaml` (inventory-service section) | `backend/inventory-service/k8s/configmap.yaml` |
| `k8s/configmap.yaml` (notification-service section) | `backend/notification-service/k8s/configmap.yaml` |
| `k8s/configmap.yaml` (localstack section) | `k8s/infrastructure/localstack/deployment.yaml` |

### Unchanged Files
These files remain in the k8s/ directory:
- `namespace.yaml` - Global namespace
- `secrets.yaml` - Shared secrets
- `pvc.yaml` - All PVCs
- `ingress.yaml` - Ingress rules
- `deploy.sh` - Main deployment script (updated)
- `undeploy.sh` - Cleanup script
- `build-images.sh` - Image build script
- Documentation files

## Key Changes in deploy.sh

### Old deploy.sh
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/api-gateway-deployment.yaml
kubectl apply -f k8s/order-service-deployment.yaml
# ... etc
```

### New deploy.sh
```bash
# Deploy service-specific files
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl apply -f backend/order-service/k8s/database/statefulset.yaml
kubectl apply -f backend/order-service/k8s/service.yaml
kubectl apply -f backend/order-service/k8s/deployment.yaml

# Deploy infrastructure
kubectl apply -f k8s/infrastructure/redis/statefulset.yaml
kubectl apply -f k8s/infrastructure/kafka/kafka-stack.yaml
```

## Common Issues and Solutions

### Issue 1: "File not found" errors
**Problem**: Old scripts reference old file paths

**Solution**: Use the updated `deploy.sh` script
```bash
cd k8s
./deploy.sh --all
```

### Issue 2: ConfigMap not found
**Problem**: ConfigMaps split into separate files

**Solution**: Each service now has its own ConfigMap
```bash
kubectl get configmap -n demo-micro
```

### Issue 3: Deployment order matters
**Problem**: Services fail if dependencies not ready

**Solution**: The new deploy.sh handles proper ordering:
1. Namespace, Secrets, PVCs
2. Infrastructure (Redis, LocalStack)
3. Databases
4. Microservices
5. API Gateway

### Issue 4: Need to deploy single service
**Problem**: Don't want to redeploy everything

**Solution**: Deploy individual service
```bash
kubectl apply -f backend/order-service/k8s/configmap.yaml
kubectl apply -f backend/order-service/k8s/service.yaml
kubectl apply -f backend/order-service/k8s/deployment.yaml
```

## Rollback Procedure

If you need to rollback to the old structure:

```bash
# 1. Undeploy new structure
cd k8s
./undeploy.sh

# 2. Restore old files
rm -rf k8s
mv k8s-old-backup k8s

# 3. Restore old deployment
cd k8s
./deploy.sh
```

## CI/CD Updates

If you're using CI/CD pipelines, update your workflow to reference new paths:

### Old GitHub Actions
```yaml
- name: Deploy
  run: |
    kubectl apply -f k8s/
```

### New GitHub Actions
```yaml
- name: Deploy
  run: |
    cd k8s
    ./deploy.sh --all
```

Or for specific service:
```yaml
- name: Deploy Order Service
  run: |
    kubectl apply -f backend/order-service/k8s/
```

## Developer Workflow

### Working on a Single Service

1. **Make changes** to service code
2. **Update K8s manifests** in `backend/<service>/k8s/` if needed
3. **Build image**: `cd k8s && ./build-images.sh`
4. **Deploy service**:
   ```bash
   kubectl apply -f backend/<service>/k8s/
   ```
5. **Verify**: `kubectl get pods -n demo-micro`

### Adding New Configuration

1. **Edit** `backend/<service>/k8s/configmap.yaml`
2. **Apply** changes:
   ```bash
   kubectl apply -f backend/<service>/k8s/configmap.yaml
   kubectl rollout restart deployment/<service> -n demo-micro
   ```

## Future Improvements

Consider these enhancements:

1. **Kustomize Overlays**: Use kustomize for dev/staging/prod environments
2. **Helm Charts**: Package each service as a Helm chart
3. **GitOps**: Implement ArgoCD or Flux for declarative deployment
4. **Service Mesh**: Add Istio or Linkerd for advanced networking
5. **Sealed Secrets**: Use sealed-secrets for secure secret management

## Questions?

For assistance with migration:
- Check STRUCTURE.md for detailed structure documentation
- Review the updated README.md
- Check deployment logs: `kubectl logs -f <pod> -n demo-micro`
- Contact the DevOps team

## Summary

✅ **Completed**:
- Service-specific K8s manifests created
- Database configs moved with services
- Infrastructure centralized
- Deploy script updated
- Redundant files removed

🎯 **Benefits**:
- Better organization
- Clear ownership
- Independent deployment
- Follows best practices
- Easier to maintain

🚀 **Next Steps**:
1. Test the new deployment
2. Update CI/CD pipelines
3. Train team on new structure
4. Consider GitOps adoption
