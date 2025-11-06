# 🚨 Troubleshooting: Connection Refused Error

## Error: `ECONNREFUSED 127.0.0.1:8080`

This means the API Gateway is not accessible on port 8080.

---

## ✅ **Step-by-Step Fix**

### **Step 1: Check if Kubernetes Cluster is Running**

```bash
kubectl cluster-info
```

**Expected:** Cluster info displayed  
**If Error:** Start your cluster first (see below)

---

### **Step 2: Check if Services are Deployed**

```bash
kubectl get pods -n demo-micro
```

**Expected Output:**
```
NAME                                   READY   STATUS    RESTARTS   AGE
api-gateway-xxxxx                      1/1     Running   0          5m
order-service-xxxxx                    1/1     Running   0          5m
inventory-service-xxxxx                1/1     Running   0          5m
notification-service-xxxxx             1/1     Running   0          5m
```

**If Empty or No Pods:** Deploy services first (see Step A below)

---

### **Step 3: Check if Port Forward is Running**

```bash
# Check if port 8080 is in use
netstat -ano | findstr :8080
# Or on Mac/Linux:
lsof -i :8080
```

**If Nothing:** Port forward is not running (see Step B below)

---

## 🚀 **Step A: Deploy Services (If Not Deployed)**

### **Check Cluster Status First:**

#### **For Docker Desktop:**
1. Open Docker Desktop
2. Go to **Settings** → **Kubernetes**
3. Check **"Enable Kubernetes"**
4. Click **"Apply & Restart"**
5. Wait 2-3 minutes

#### **For Minikube:**
```bash
minikube status
# If not running:
minikube start --cpus=4 --memory=8192
```

#### **Verify Cluster:**
```bash
kubectl cluster-info
kubectl get nodes
```

### **Deploy the Microservices:**

```bash
# Navigate to scripts directory
cd k8s/scripts

# Deploy everything
./deploy.sh --all

# Or on Windows:
deploy.bat
```

**Wait for deployment** (5-10 minutes for all services)

---

## 🔌 **Step B: Set Up Port Forwarding**

### **Option 1: Port Forward API Gateway (Recommended)**

```bash
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro
```

**Expected Output:**
```
Forwarding from 127.0.0.1:8080 -> 8080
Forwarding from [::1]:8080 -> 8080
```

**Keep this terminal open!** Close it and the connection stops.

### **Option 2: Use NodePort (If Available)**

Check if NodePort is configured:
```bash
kubectl get svc api-gateway -n demo-micro
```

**If TYPE shows `NodePort`:**
```bash
# Get the NodePort
kubectl get svc api-gateway -n demo-micro -o jsonpath='{.spec.ports[0].nodePort}'
```

Use that port instead: `http://localhost:30080` (typical NodePort)

---

## 🧪 **Verify Connection**

### **Test 1: Check API Gateway Health**

```bash
curl http://localhost:8080/health
```

**Expected:** `{"status":"ok"}` or similar

### **Test 2: Test GraphQL Endpoint**

```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

**Expected:** JSON response

### **Test 3: In Postman**

- Method: `GET`
- URL: `http://localhost:8080/health`
- Click **Send**

**Expected:** 200 OK

---

## 🔍 **Common Issues & Solutions**

### **Issue 1: Cluster Not Running**

**Error:** `Unable to connect to the server`

**Solution:**
```bash
# Docker Desktop: Enable Kubernetes in settings
# Or Minikube:
minikube start
```

---

### **Issue 2: Namespace Doesn't Exist**

**Error:** `namespace "demo-micro" not found`

**Solution:**
```bash
kubectl create namespace demo-micro
# Or deploy using the script which creates it automatically
cd k8s/scripts
./deploy.sh --all
```

---

### **Issue 3: API Gateway Pod Not Running**

**Check Status:**
```bash
kubectl get pods -n demo-micro | grep api-gateway
```

**If STATUS is not "Running":**

```bash
# Check what's wrong
kubectl describe pod -l app=api-gateway -n demo-micro

# Check logs
kubectl logs -l app=api-gateway -n demo-micro --tail=50
```

**Common fixes:**
- Wait longer (pod might still be starting)
- Check if image exists: `kubectl describe pod <pod-name> -n demo-micro`
- Check for ImagePullBackOff errors
- Restart pod: `kubectl delete pod -l app=api-gateway -n demo-micro`

---

### **Issue 4: Port Already in Use**

**Error:** `bind: address already in use`

**Solution:**
```bash
# Find what's using port 8080
netstat -ano | findstr :8080

# Kill the process (Windows - replace PID)
taskkill /PID <PID> /F

# Or use a different port
kubectl port-forward service/api-gateway 8081:8080 -n demo-micro
# Then use http://localhost:8081 in Postman
```

---

### **Issue 5: Service Not Found**

**Error:** `service "api-gateway" not found`

**Check Services:**
```bash
kubectl get svc -n demo-micro
```

**If api-gateway is missing:**
```bash
# Deploy api-gateway
kubectl apply -f backend/api-gateway/k8s/service.yaml
kubectl apply -f backend/api-gateway/k8s/deployment.yaml
```

---

## 📋 **Complete Diagnostic Checklist**

Run these commands in order:

```bash
# 1. Check cluster
kubectl cluster-info

# 2. Check namespace
kubectl get ns demo-micro

# 3. Check all pods
kubectl get pods -n demo-micro

# 4. Check services
kubectl get svc -n demo-micro

# 5. Check specific pod
kubectl get pods -n demo-micro | grep api-gateway

# 6. Check pod details (if not running)
kubectl describe pod -l app=api-gateway -n demo-micro

# 7. Check logs
kubectl logs -l app=api-gateway -n demo-micro --tail=100

# 8. Test port forward
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro
# Keep this running in a separate terminal

# 9. Test connection (in another terminal)
curl http://localhost:8080/health
```

---

## 🎯 **Quick Fix - Start Fresh**

If nothing works, start from scratch:

```bash
# 1. Make sure cluster is running
kubectl cluster-info

# 2. Deploy everything
cd k8s/scripts
./deploy.sh --all

# 3. Wait for pods to be ready (check every 30 seconds)
watch kubectl get pods -n demo-micro

# 4. Once all pods show 1/1 Running, set up port forward
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro

# 5. Test in another terminal
curl http://localhost:8080/health

# 6. Now try Postman!
```

---

## 💡 **Best Practices**

### **Keep Port Forward Running**
- Open a dedicated terminal for port-forward
- Don't close it while testing
- If it closes, run the command again

### **Monitor Pod Status**
```bash
# Watch pods in real-time
kubectl get pods -n demo-micro -w
```

### **Check Logs Regularly**
```bash
# API Gateway logs
kubectl logs -f deployment/api-gateway -n demo-micro

# All services
kubectl logs -f deployment/order-service -n demo-micro
kubectl logs -f deployment/inventory-service -n demo-micro
kubectl logs -f deployment/notification-service -n demo-micro
```

---

## 📞 **Still Not Working?**

### **Share This Info:**

```bash
# 1. Cluster status
kubectl cluster-info

# 2. Pod status
kubectl get pods -n demo-micro

# 3. Service status
kubectl get svc -n demo-micro

# 4. API Gateway pod details
kubectl describe pod -l app=api-gateway -n demo-micro

# 5. API Gateway logs
kubectl logs -l app=api-gateway -n demo-micro --tail=100
```

---

## 🌐 **Alternative Access Methods**

### **Method 1: NodePort (No Port Forward Needed)**

Update the API Gateway service to use NodePort:

```yaml
# backend/api-gateway/k8s/service.yaml
spec:
  type: NodePort
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080
```

Then access: `http://localhost:30080`

### **Method 2: Direct Pod Access (Testing Only)**

```bash
# Get pod name
POD_NAME=$(kubectl get pod -l app=api-gateway -n demo-micro -o jsonpath='{.items[0].metadata.name}')

# Forward directly to pod
kubectl port-forward pod/$POD_NAME 8080:8080 -n demo-micro
```

### **Method 3: Ingress (Advanced)**

If you deployed with ingress:
```bash
# Check ingress
kubectl get ingress -n demo-micro

# Add to hosts file (as admin)
# Linux/Mac: /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts
<MINIKUBE_IP> api.demo-micro.local

# Access via: http://api.demo-micro.local
```

---

## ✅ **Success Checklist**

- [ ] Kubernetes cluster is running
- [ ] `demo-micro` namespace exists
- [ ] All pods are in `Running` state (1/1)
- [ ] Port forward is active (8080:8080)
- [ ] Health check returns 200 OK
- [ ] Postman can connect
- [ ] GraphQL endpoint responds

---

## 🎉 **Once Connected**

Update Postman BASE_URL if using different port:
1. Open collection
2. Go to **Variables** tab
3. Change `BASE_URL` from `http://localhost:8080` to your actual URL
4. Save
5. Test again!

---

**Most Common Fix:** Just run port-forward! 
```bash
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro
```

