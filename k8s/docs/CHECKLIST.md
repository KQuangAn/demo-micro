# Kubernetes Deployment Checklist

Use this checklist to ensure your Kubernetes deployment is complete and functional.

## 📋 Pre-Deployment Checklist

### Environment Setup

- [ ] Kubernetes cluster is running (minikube/kind/cloud)
  ```bash
  kubectl cluster-info
  ```
- [ ] kubectl is installed and configured
  ```bash
  kubectl version --client
  ```
- [ ] Docker is installed and running
  ```bash
  docker --version
  ```
- [ ] Sufficient resources available:
  - [ ] CPU: 4+ cores
  - [ ] RAM: 8+ GB
  - [ ] Disk: 20+ GB free

### Project Setup

- [ ] Navigate to project directory
  ```bash
  cd /path/to/demo-micro
  ```
- [ ] Review and understand the architecture
  - [ ] Read `k8s/QUICKSTART.md`
  - [ ] Review `k8s/README.md`
  - [ ] Check `KUBERNETES-MIGRATION-SUMMARY.md`

## 🔨 Build Checklist

### Build Docker Images

- [ ] Navigate to k8s directory
  ```bash
  cd k8s
  ```
- [ ] Make build script executable
  ```bash
  chmod +x build-images.sh
  ```
- [ ] If using minikube, point to minikube's Docker daemon
  ```bash
  eval $(minikube docker-env)
  ```
- [ ] Build all images
  ```bash
  ./build-images.sh
  ```
- [ ] Verify images are built
  ```bash
  docker images | grep -E "(api-gateway|order-service|inventory-service|notification-service)"
  ```

Expected output:

```
api-gateway             latest    <image-id>   <time>   <size>
order-service           latest    <image-id>   <time>   <size>
inventory-service       latest    <image-id>   <time>   <size>
notification-service    latest    <image-id>   <time>   <size>
```

## 🚀 Deployment Checklist

### Deploy to Kubernetes

- [ ] Make deploy script executable
  ```bash
  chmod +x deploy.sh
  ```
- [ ] Run deployment script
  ```bash
  ./deploy.sh
  ```
- [ ] Wait for script to complete (5-10 minutes)

### Verify Namespace

- [ ] Check namespace exists
  ```bash
  kubectl get namespace demo-micro
  ```
  Expected: `demo-micro   Active   <age>`

### Verify ConfigMaps and Secrets

- [ ] Check ConfigMaps
  ```bash
  kubectl get configmap -n demo-micro
  ```
- [ ] Check Secrets
  ```bash
  kubectl get secrets -n demo-micro
  ```

### Verify Storage

- [ ] Check PVCs are bound
  ```bash
  kubectl get pvc -n demo-micro
  ```
  Expected status: `Bound` for all PVCs

### Verify Databases

- [ ] Check database pods
  ```bash
  kubectl get pods -n demo-micro | grep db
  ```
- [ ] Verify all database pods are Running
  ```bash
  kubectl get pods -n demo-micro -l app=order-db
  kubectl get pods -n demo-micro -l app=inventory-db
  kubectl get pods -n demo-micro -l app=notification-db
  kubectl get pods -n demo-micro -l app=redis
  ```
  Expected: `1/1 Running` for each

### Verify Services

- [ ] Check all pods are running
  ```bash
  kubectl get pods -n demo-micro
  ```
- [ ] Wait for all pods to be Ready
  ```bash
  kubectl wait --for=condition=ready pod --all -n demo-micro --timeout=300s
  ```

### Check Individual Services

- [ ] LocalStack
  ```bash
  kubectl get pods -n demo-micro -l app=localstack
  ```
- [ ] Order Service
  ```bash
  kubectl get pods -n demo-micro -l app=order-service
  ```
- [ ] Inventory Service
  ```bash
  kubectl get pods -n demo-micro -l app=inventory-service
  ```
- [ ] Notification Service
  ```bash
  kubectl get pods -n demo-micro -l app=notification-service
  ```
- [ ] API Gateway
  ```bash
  kubectl get pods -n demo-micro -l app=api-gateway
  ```

Expected: `2/2 Running` for microservices (2 replicas each)

### Verify Networking

- [ ] Check services
  ```bash
  kubectl get svc -n demo-micro
  ```
- [ ] Verify API Gateway NodePort

  ```bash
  kubectl get svc api-gateway -n demo-micro
  ```

  Expected: Port 30080 should be listed

- [ ] Check Ingress (if deployed)
  ```bash
  kubectl get ingress -n demo-micro
  ```

## ✅ Post-Deployment Verification

### Health Checks

- [ ] Run health check script
  ```bash
  chmod +x health-check.sh
  ./health-check.sh
  ```
  All services should show `HEALTHY` status

### Access Services

- [ ] Test API Gateway via NodePort

  ```bash
  curl http://localhost:30080
  ```

  Or for minikube:

  ```bash
  curl http://$(minikube ip):30080
  ```

- [ ] Access Kibana (if ELK deployed)
  ```bash
  open http://localhost:30561
  ```
  Or for minikube:
  ```bash
  minikube service kibana -n demo-micro
  ```

### Check Logs

- [ ] View API Gateway logs
  ```bash
  kubectl logs -l app=api-gateway -n demo-micro --tail=50
  ```
- [ ] Verify no critical errors in logs
  ```bash
  kubectl logs -l app=order-service -n demo-micro --tail=50
  kubectl logs -l app=inventory-service -n demo-micro --tail=50
  kubectl logs -l app=notification-service -n demo-micro --tail=50
  ```

### Check Events

- [ ] Review cluster events
  ```bash
  kubectl get events -n demo-micro --sort-by='.lastTimestamp' | tail -20
  ```
- [ ] Verify no error events

### Resource Usage

- [ ] Check resource consumption (if metrics-server installed)
  ```bash
  kubectl top pods -n demo-micro
  kubectl top nodes
  ```

## 🧪 Testing Checklist

### Basic Connectivity

- [ ] Test internal service connectivity
  ```bash
  kubectl run test-pod --rm -it --image=busybox --restart=Never -n demo-micro -- wget -O- http://api-gateway:8080
  ```

### Database Connectivity

- [ ] Test Order DB connection
  ```bash
  kubectl exec -it <order-db-pod> -n demo-micro -- psql -U postgres -d orders -c "\dt"
  ```
- [ ] Test Inventory DB connection
  ```bash
  kubectl exec -it <inventory-db-pod> -n demo-micro -- psql -U postgres -d inventory -c "\dt"
  ```
- [ ] Test MongoDB connection
  ```bash
  kubectl exec -it <mongodb-pod> -n demo-micro -- mongo -u admin -p root --authenticationDatabase admin
  ```
- [ ] Test Redis connection
  ```bash
  kubectl exec -it <redis-pod> -n demo-micro -- redis-cli ping
  ```

### Service Endpoints

- [ ] Test API Gateway endpoint
  ```bash
  curl http://localhost:30080/
  ```
- [ ] Test GraphQL endpoint (if applicable)
  ```bash
  curl -X POST http://localhost:30080/graphql -H "Content-Type: application/json" -d '{"query":"{ __schema { types { name } } }"}'
  ```

## 🔧 Optional Features Checklist

### Ingress Setup

- [ ] Enable Ingress controller (minikube)
  ```bash
  minikube addons enable ingress
  ```
- [ ] Deploy Ingress rules
  ```bash
  kubectl apply -f k8s/ingress.yaml
  ```
- [ ] Get Ingress IP
  ```bash
  kubectl get ingress -n demo-micro
  ```
- [ ] Update /etc/hosts with Ingress domains
  ```bash
  echo "$(minikube ip) api.demo-micro.local" | sudo tee -a /etc/hosts
  ```
- [ ] Test Ingress access
  ```bash
  curl http://api.demo-micro.local
  ```

### ELK Stack (if deployed)

- [ ] Verify Elasticsearch is running
  ```bash
  kubectl get pods -n demo-micro -l app=elasticsearch
  ```
- [ ] Access Kibana
  ```bash
  open http://localhost:30561
  ```
- [ ] Configure Kibana index patterns
- [ ] Verify logs are being collected

### Monitoring Setup

- [ ] Install metrics-server (if needed)
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```
- [ ] Verify metrics are available
  ```bash
  kubectl top nodes
  kubectl top pods -n demo-micro
  ```

## 📊 Scaling Checklist

### Manual Scaling

- [ ] Scale API Gateway
  ```bash
  kubectl scale deployment api-gateway --replicas=3 -n demo-micro
  ```
- [ ] Verify scaling
  ```bash
  kubectl get pods -n demo-micro -l app=api-gateway
  ```

### Auto-scaling (HPA)

- [ ] Create HPA for API Gateway
  ```bash
  kubectl autoscale deployment api-gateway --cpu-percent=70 --min=2 --max=10 -n demo-micro
  ```
- [ ] Check HPA status
  ```bash
  kubectl get hpa -n demo-micro
  ```

## 🔐 Security Checklist

### Update Secrets (IMPORTANT!)

- [ ] Generate new passwords
- [ ] Update PostgreSQL credentials
- [ ] Update MongoDB credentials
- [ ] Update Redis password
- [ ] Update AWS credentials (if using real AWS)
- [ ] Update Elasticsearch password
- [ ] Apply updated secrets
  ```bash
  kubectl apply -f k8s/secrets.yaml
  kubectl rollout restart deployment --all -n demo-micro
  ```

### RBAC and Network Policies (Production)

- [ ] Review and apply RBAC policies
- [ ] Implement network policies
- [ ] Enable pod security policies
- [ ] Configure service accounts

## 📝 Documentation Checklist

### Update Documentation

- [ ] Document any custom changes
- [ ] Update README with specific instructions
- [ ] Document environment-specific configurations
- [ ] Create runbook for common operations

### Share Knowledge

- [ ] Share deployment guide with team
- [ ] Document troubleshooting steps
- [ ] Create architecture diagrams
- [ ] Document scaling procedures

## 🚨 Troubleshooting Checklist

### If Pods Fail to Start

- [ ] Check pod description
  ```bash
  kubectl describe pod <pod-name> -n demo-micro
  ```
- [ ] Check pod logs
  ```bash
  kubectl logs <pod-name> -n demo-micro
  ```
- [ ] Check events
  ```bash
  kubectl get events -n demo-micro --sort-by='.lastTimestamp'
  ```
- [ ] Verify resource availability
  ```bash
  kubectl top nodes
  ```

### If Services are Unreachable

- [ ] Verify service exists
  ```bash
  kubectl get svc -n demo-micro
  ```
- [ ] Check service endpoints
  ```bash
  kubectl get endpoints -n demo-micro
  ```
- [ ] Test from within cluster
  ```bash
  kubectl run test --rm -it --image=busybox -n demo-micro -- wget -O- http://api-gateway:8080
  ```

### If Images Don't Pull

- [ ] For minikube, ensure using minikube's Docker daemon
  ```bash
  eval $(minikube docker-env)
  ```
- [ ] Rebuild images
  ```bash
  ./build-images.sh
  ```
- [ ] Verify images exist
  ```bash
  docker images
  ```

## 🧹 Cleanup Checklist

### When You're Done Testing

- [ ] Run undeploy script
  ```bash
  ./undeploy.sh
  ```
- [ ] Or delete namespace manually
  ```bash
  kubectl delete namespace demo-micro
  ```
- [ ] Remove PVCs if needed
  ```bash
  kubectl get pvc --all-namespaces
  ```
- [ ] Clean up Docker images
  ```bash
  docker rmi api-gateway:latest order-service:latest inventory-service:latest notification-service:latest
  ```

### Minikube Cleanup

- [ ] Stop minikube
  ```bash
  minikube stop
  ```
- [ ] Delete minikube cluster (optional)
  ```bash
  minikube delete
  ```

## ✨ Success Criteria

Your deployment is successful when:

✅ All pods are in `Running` state  
✅ All pods show `READY 1/1` or `2/2`  
✅ API Gateway is accessible on port 30080  
✅ Health check script shows all services as HEALTHY  
✅ No critical errors in pod logs  
✅ Services can communicate with each other  
✅ Databases are accessible and functional

## 🎉 Congratulations!

If all items are checked, your microservices application is now successfully running on Kubernetes!

### Next Steps:

1. Explore the services
2. Test your APIs
3. Monitor logs and metrics
4. Plan for production deployment
5. Set up CI/CD pipeline

### Additional Resources:

- `k8s/README.md` - Comprehensive guide
- `k8s/QUICKSTART.md` - Quick start guide
- `k8s/DOCKER-VS-K8S.md` - Comparison guide
- `KUBERNETES-MIGRATION-SUMMARY.md` - Migration summary

Happy Kuberneting! 🚀
