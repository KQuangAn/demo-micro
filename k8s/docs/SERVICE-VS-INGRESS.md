# Kubernetes Service vs Ingress - Complete Guide

## Quick Comparison

| Aspect            | Service                            | Ingress                             |
| ----------------- | ---------------------------------- | ----------------------------------- |
| **Purpose**       | Expose pods within/outside cluster | HTTP/HTTPS routing & load balancing |
| **Layer**         | L4 (Transport - TCP/UDP)           | L7 (Application - HTTP/HTTPS)       |
| **Protocol**      | Any (TCP, UDP, SCTP)               | HTTP/HTTPS only                     |
| **Routing**       | Simple port-based                  | Advanced (host, path, headers)      |
| **SSL/TLS**       | ❌ No built-in support             | ✅ Built-in SSL termination         |
| **Load Balancer** | 1 per Service (costly)             | 1 for many Services (efficient)     |
| **Cost**          | $15-50/month per LB                | $15-50/month for ALL services       |
| **Use Case**      | Basic exposure                     | Production web apps                 |

## The Key Difference

```
SERVICE = Network endpoint to reach pods
INGRESS = Smart HTTP router to multiple services
```

### Analogy

**Service** = Individual phone numbers for each department

- Sales: 555-0001
- Support: 555-0002
- Billing: 555-0003
- Cost: $50/month × 3 = $150/month

**Ingress** = Single reception desk (555-0000) that routes calls

- "Press 1 for Sales" → Transfers to Sales department
- "Press 2 for Support" → Transfers to Support department
- "Press 3 for Billing" → Transfers to Billing department
- Cost: $50/month total

## Architecture Comparison

### Using Only Services (LoadBalancer)

```
                     Internet
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   LoadBalancer    LoadBalancer    LoadBalancer
     ($50/mo)        ($50/mo)        ($50/mo)
        │               │               │
   52.1.2.3:80    52.4.5.6:80    52.7.8.9:80
        │               │               │
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ Service │     │ Service │     │ Service │
  │Frontend │     │   API   │     │  Admin  │
  └─────────┘     └─────────┘     └─────────┘
        │               │               │
    Frontend         API            Admin
     Pods            Pods           Pods

💰 Total Cost: $150/month for 3 services
⚠️  Problem: Need to manage 3 different IPs/DNS names
```

### Using Ingress (Recommended)

```
                     Internet
                        │
                   Ingress LB
                   ($50/mo)
                 api.demo.com
                        │
              ┌─────────┼─────────┐
              │      INGRESS      │
              │   (Smart Router)  │
              │                   │
              │  - SSL Handling   │
              │  - Path Routing   │
              │  - Host Routing   │
              └─────────┬─────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ Service │     │ Service │     │ Service │
  │Frontend │     │   API   │     │  Admin  │
  │ClusterIP│     │ClusterIP│     │ClusterIP│
  └─────────┘     └─────────┘     └─────────┘
        │               │               │
    Frontend         API            Admin
     Pods            Pods           Pods

💰 Total Cost: $50/month for ALL services
✅ Benefit: Single DNS name, SSL, smart routing
```

## Detailed Comparison

### 1. Service Types and Their Purpose

#### ClusterIP (Default Service)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  type: ClusterIP # ← Internal only
  selector:
    app: order-service
  ports:
    - port: 9001
      targetPort: 9001
```

**Purpose:**

- ✅ Pod-to-pod communication inside cluster
- ❌ NOT accessible from outside
- 💰 Free (no cloud resources)

**Use Case:**

```
API Gateway → order-service:9001 (internal call)
```

#### NodePort Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: NodePort # ← External access via node IP
  selector:
    app: api-gateway
  ports:
    - port: 8080
      targetPort: 8080
      nodePort: 30080 # ← Access via <node-ip>:30080
```

**Purpose:**

- ✅ External access for development/testing
- ⚠️ Must use node IP + high port (30000-32767)
- 💰 Free (no cloud resources)

**Use Case:**

```bash
# Development/Testing
curl http://192.168.49.2:30080/graphql
```

#### LoadBalancer Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: LoadBalancer # ← Cloud load balancer
  selector:
    app: api-gateway
  ports:
    - port: 80
      targetPort: 8080
```

**Purpose:**

- ✅ Production external access
- ✅ Single external IP
- 💰 $15-50/month per service (AWS ELB/NLB, GCP LB, Azure LB)

**Use Case:**

```bash
# Production
curl http://a1b2c3d4.us-east-1.elb.amazonaws.com
```

### 2. Ingress - The Smart Router

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod # ← Auto SSL
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.demo-micro.com
      secretName: demo-tls-cert
  rules:
    - host: api.demo-micro.com
      http:
        paths:
          # Route /api → API Gateway
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  number: 8080

          # Route /docs → Documentation
          - path: /docs
            pathType: Prefix
            backend:
              service:
                name: docs-service
                port:
                  number: 3000

          # Route / → Frontend
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

**Purpose:**

- ✅ Single entry point for multiple services
- ✅ Path-based routing (`/api`, `/docs`, `/`)
- ✅ Host-based routing (subdomain routing)
- ✅ SSL/TLS termination
- ✅ Advanced features (rate limiting, auth, rewrites)
- 💰 $15-50/month for ALL services (shared LB)

## When to Use Each

### Use Service ONLY (No Ingress)

#### 1. **Internal Microservices** → ClusterIP

```yaml
# Order Service - only called by API Gateway
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  type: ClusterIP
  ports:
    - port: 9001
```

**Why:** No external access needed, purely internal communication.

#### 2. **Databases** → ClusterIP

```yaml
# PostgreSQL - only called by Order Service
apiVersion: v1
kind: Service
metadata:
  name: postgres-order
spec:
  type: ClusterIP
  ports:
    - port: 5432
```

**Why:** Databases should NEVER be exposed externally.

#### 3. **Development/Testing** → NodePort

```yaml
# Quick external access for testing
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: NodePort
  ports:
    - nodePort: 30080
```

**Why:** Fast setup for local development, no DNS needed.

#### 4. **Non-HTTP Services** → LoadBalancer

```yaml
# TCP service (not HTTP)
apiVersion: v1
kind: Service
metadata:
  name: tcp-game-server
spec:
  type: LoadBalancer
  ports:
    - port: 7777
      protocol: TCP
```

**Why:** Ingress only works with HTTP/HTTPS. For TCP/UDP, use LoadBalancer.

### Use Ingress (Production Web Apps)

#### 1. **Multiple HTTP Services**

```yaml
# Route to different services based on path
spec:
  rules:
    - host: demo-micro.com
      http:
        paths:
          - path: /api
            backend:
              service:
                name: api-gateway
          - path: /admin
            backend:
              service:
                name: admin-panel
          - path: /
            backend:
              service:
                name: frontend
```

**Why:** One load balancer serves all services, saves money.

#### 2. **Multiple Domains/Subdomains**

```yaml
spec:
  rules:
    - host: api.demo-micro.com # ← API subdomain
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-gateway

    - host: admin.demo-micro.com # ← Admin subdomain
      http:
        paths:
          - path: /
            backend:
              service:
                name: admin-panel

    - host: www.demo-micro.com # ← Public website
      http:
        paths:
          - path: /
            backend:
              service:
                name: frontend
```

**Why:** Professional setup with proper DNS structure.

#### 3. **SSL/HTTPS Required**

```yaml
spec:
  tls:
    - hosts:
        - demo-micro.com
        - api.demo-micro.com
      secretName: demo-tls-cert
  rules:
    - host: demo-micro.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: frontend
```

**Why:** Ingress handles SSL automatically, Services can't.

#### 4. **Advanced Routing Rules**

```yaml
metadata:
  annotations:
    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: '100'

    # Authentication
    nginx.ingress.kubernetes.io/auth-url: 'https://auth.demo.com'

    # URL rewriting
    nginx.ingress.kubernetes.io/rewrite-target: /$2

    # CORS
    nginx.ingress.kubernetes.io/enable-cors: 'true'
```

**Why:** Complex production requirements that Services can't handle.

## Real-World Examples

### Example 1: Your demo-micro Project

#### Current Setup (Development)

```yaml
# NodePort for quick testing
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: NodePort
  ports:
    - nodePort: 30080
      port: 8080
# Access: http://localhost:30080/graphql
```

#### Production Setup (with Ingress)

```yaml
# 1. Change Service to ClusterIP
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: ClusterIP # ← Changed from NodePort
  ports:
    - port: 8080

---
# 2. Add Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-micro-ingress
  namespace: demo-micro
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.demo-micro.com
      secretName: demo-micro-tls
  rules:
    - host: api.demo-micro.com
      http:
        paths:
          - path: /graphql
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  number: 8080

          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 9001

          - path: /inventory
            pathType: Prefix
            backend:
              service:
                name: inventory-service
                port:
                  number: 9000
# Access: https://api.demo-micro.com/graphql (SSL enabled)
```

### Example 2: E-commerce Platform

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecommerce-ingress
spec:
  rules:
    - host: shop.example.com
      http:
        paths:
          # Frontend
          - path: /
            backend:
              service:
                name: frontend
                port: 80

          # API
          - path: /api/v1
            backend:
              service:
                name: api-gateway
                port: 8080

          # Admin Panel
          - path: /admin
            backend:
              service:
                name: admin-panel
                port: 3000

          # Checkout (separate service)
          - path: /checkout
            backend:
              service:
                name: checkout-service
                port: 8081
# All services behind ONE load balancer!
# Cost: $50/month vs $200/month with 4 LoadBalancer services
```

### Example 3: Microservices with Subdomains

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: microservices-ingress
spec:
  rules:
    # Public website
    - host: www.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: frontend
                port: 80

    # API for mobile/web apps
    - host: api.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-gateway
                port: 8080

    # Admin dashboard
    - host: admin.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: admin-panel
                port: 3000

    # Documentation
    - host: docs.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: docs
                port: 4000
```

## Service + Ingress: How They Work Together

```
Internet Request: https://api.demo-micro.com/orders/123
                        ↓
                  [DNS Resolution]
                        ↓
              LoadBalancer (52.1.2.3)
                        ↓
              ┌─────────────────┐
              │  Ingress Ctrl   │
              │  (nginx pod)    │
              │                 │
              │ 1. Check host   │
              │ 2. Check path   │
              │ 3. Route to     │
              │    Service      │
              └────────┬────────┘
                       │
              Path: /orders → order-service
                       │
              ┌────────▼────────┐
              │    Service      │
              │  order-service  │
              │  ClusterIP      │
              │  10.96.0.50     │
              └────────┬────────┘
                       │
              Load Balance to Pods
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
   │ Pod 1  │    │ Pod 2  │    │ Pod 3  │
   │ Order  │    │ Order  │    │ Order  │
   │ Service│    │ Service│    │ Service│
   └────────┘    └────────┘    └────────┘
```

**Key Points:**

1. **Ingress** receives external traffic
2. **Ingress** routes based on host/path rules
3. **Service** load balances to pods
4. **Pods** handle the actual request

**Both are needed!**

- Ingress: Smart HTTP routing
- Service: Pod discovery & load balancing

## Feature Comparison Table

| Feature             | ClusterIP | NodePort       | LoadBalancer     | Ingress           |
| ------------------- | --------- | -------------- | ---------------- | ----------------- |
| **Internal Access** | ✅        | ✅             | ✅               | ✅ (via Services) |
| **External Access** | ❌        | ✅ (node:port) | ✅ (external IP) | ✅ (domain)       |
| **Path Routing**    | ❌        | ❌             | ❌               | ✅                |
| **Host Routing**    | ❌        | ❌             | ❌               | ✅                |
| **SSL/TLS**         | ❌        | ❌             | ❌               | ✅                |
| **URL Rewriting**   | ❌        | ❌             | ❌               | ✅                |
| **Rate Limiting**   | ❌        | ❌             | ❌               | ✅                |
| **Authentication**  | ❌        | ❌             | ❌               | ✅                |
| **CORS Headers**    | ❌        | ❌             | ❌               | ✅                |
| **WebSocket**       | ✅        | ✅             | ✅               | ✅                |
| **gRPC**            | ✅        | ✅             | ✅               | ✅ (with config)  |
| **TCP (non-HTTP)**  | ✅        | ✅             | ✅               | ❌                |
| **UDP**             | ✅        | ✅             | ✅               | ❌                |
| **Cost (AWS/GCP)**  | Free      | Free           | $15-50/mo each   | $15-50/mo total   |
| **DNS Required**    | ❌        | ❌             | Optional         | ✅                |
| **OSI Layer**       | L4        | L4             | L4               | L7                |

## Migration Path: Development → Production

### Phase 1: Development (Your Current Setup)

```yaml
# Use NodePort for quick testing
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: NodePort
  ports:
    - nodePort: 30080
      port: 8080
# Access: http://localhost:30080
# ✅ Fast setup, no DNS needed
# ⚠️ Not suitable for production
```

### Phase 2: Basic Production (LoadBalancer)

```yaml
# Use LoadBalancer for production
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 8080
# Access: http://<external-ip>
# ✅ Production-ready
# ⚠️ Costs $50/month per service
```

### Phase 3: Professional Production (Ingress)

```yaml
# 1. Change to ClusterIP
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: ClusterIP
  ports:
    - port: 8080

---
# 2. Add Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.demo-micro.com
      secretName: tls-cert
  rules:
    - host: api.demo-micro.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-gateway
                port:
                  number: 8080
# Access: https://api.demo-micro.com
# ✅ Professional setup
# ✅ SSL enabled
# ✅ Cost-effective ($50/month for all services)
```

## Popular Ingress Controllers

### 1. NGINX Ingress (Most Popular)

```bash
# Install
helm install nginx-ingress ingress-nginx/ingress-nginx

# Features:
# ✅ Battle-tested
# ✅ Great performance
# ✅ Extensive documentation
# ✅ Free & open source
```

### 2. Traefik (Modern & Easy)

```bash
# Install
helm install traefik traefik/traefik

# Features:
# ✅ Auto-discovery
# ✅ Beautiful dashboard
# ✅ Let's Encrypt built-in
# ✅ Free & open source
```

### 3. AWS ALB Ingress (AWS Only)

```bash
# Install AWS Load Balancer Controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller

# Features:
# ✅ Deep AWS integration
# ✅ WAF support
# ✅ Cost optimization
# ⚠️ AWS only
```

### 4. Kong Ingress (API Gateway)

```bash
# Install
helm install kong kong/kong

# Features:
# ✅ Full API gateway features
# ✅ Plugins (auth, rate limit, etc.)
# ✅ Enterprise support available
# ⚠️ More complex
```

## Common Patterns

### Pattern 1: API + Frontend

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  rules:
    - host: myapp.com
      http:
        paths:
          # API routes
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080

          # Everything else → Frontend
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

### Pattern 2: Multiple Environments

```yaml
# Production
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prod-ingress
spec:
  rules:
    - host: api.myapp.com # ← Production domain
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-prod
                port:
                  number: 8080

---
# Staging
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: staging-ingress
spec:
  rules:
    - host: staging.api.myapp.com # ← Staging subdomain
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-staging
                port:
                  number: 8080
```

### Pattern 3: Canary Deployment

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: canary-ingress
  annotations:
    nginx.ingress.kubernetes.io/canary: 'true'
    nginx.ingress.kubernetes.io/canary-weight: '10' # ← 10% traffic
spec:
  rules:
    - host: api.myapp.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-v2 # ← New version
                port:
                  number: 8080
```

## Troubleshooting

### Service Issues

```bash
# Check if Service exists
kubectl get svc -n demo-micro

# Check Service endpoints (are pods registered?)
kubectl get endpoints order-service -n demo-micro

# Test Service from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://order-service:9001/health

# Check Service labels match Pod labels
kubectl get svc order-service -o yaml | grep selector
kubectl get pods -n demo-micro --show-labels
```

### Ingress Issues

```bash
# Check if Ingress Controller is running
kubectl get pods -n ingress-nginx

# Check Ingress resource
kubectl get ingress -n demo-micro
kubectl describe ingress demo-ingress -n demo-micro

# Check Ingress Controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Test DNS resolution
nslookup api.demo-micro.com

# Check if backend Service exists
kubectl get svc api-gateway -n demo-micro
```

### Common Errors

#### "503 Service Temporarily Unavailable"

```bash
# Ingress can't reach Service
# Check:
1. Service exists: kubectl get svc api-gateway
2. Service has endpoints: kubectl get endpoints api-gateway
3. Pods are running: kubectl get pods -l app=api-gateway
4. Service name in Ingress matches actual Service name
```

#### "404 Not Found"

```bash
# Path doesn't match
# Check:
1. Ingress path: kubectl get ingress demo-ingress -o yaml
2. Try exact path: curl https://api.demo.com/api (not /api/)
3. Check pathType: Prefix vs Exact
```

#### "SSL Certificate Error"

```bash
# TLS not configured properly
# Check:
1. Secret exists: kubectl get secret demo-tls-cert
2. cert-manager is running: kubectl get pods -n cert-manager
3. Certificate issued: kubectl get certificate
```

## Decision Matrix

### Choose ClusterIP Service When:

- ✅ Service only needs internal access
- ✅ Called by other pods in cluster
- ✅ Database, cache, internal API
- 💰 Always free

### Choose NodePort Service When:

- ✅ Development/testing environment
- ✅ Quick external access needed
- ✅ No DNS setup required
- ✅ Learning Kubernetes
- 💰 Free, but port range limited (30000-32767)

### Choose LoadBalancer Service When:

- ✅ Production, but NO Ingress Controller available
- ✅ Non-HTTP protocol (TCP/UDP game servers, databases)
- ✅ Only ONE service needs external access
- ⚠️ Cost: $15-50/month per service

### Choose Ingress When:

- ✅ Multiple HTTP/HTTPS services
- ✅ Need path-based routing (`/api`, `/docs`)
- ✅ Need host-based routing (subdomains)
- ✅ Need SSL/TLS
- ✅ Need advanced features (auth, rate limit, CORS)
- ✅ Production web applications
- 💰 Cost: $15-50/month for ALL services

## Quick Reference

### Service YAML Templates

```yaml
# ClusterIP (Internal)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080

---
# NodePort (Dev/Test)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080

---
# LoadBalancer (Production)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
```

### Ingress YAML Template

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.com
      secretName: tls-cert
  rules:
    - host: myapp.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

### Useful Commands

```bash
# Services
kubectl get svc                           # List services
kubectl get svc -A                        # All namespaces
kubectl describe svc my-service           # Service details
kubectl get endpoints my-service          # Check pod registration
kubectl port-forward svc/my-service 8080:80  # Local access

# Ingress
kubectl get ingress                       # List ingress
kubectl get ingress -A                    # All namespaces
kubectl describe ingress my-ingress       # Ingress details
kubectl get ingressclass                  # Available controllers

# Debugging
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://my-service:80

kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## Summary

### The Golden Rule

```
Service = HOW to reach pods (networking layer)
Ingress = WHEN to reach which service (routing layer)
```

### For Your demo-micro Project

**Current (Development):**

```yaml
api-gateway: NodePort (30080) # ✅ Good for dev
order-service: ClusterIP # ✅ Correct (internal)
inventory-service: ClusterIP # ✅ Correct (internal)
notification-service: ClusterIP # ✅ Correct (internal)
databases: ClusterIP # ✅ Correct (internal)
```

**Recommended (Production):**

```yaml
# 1. Change api-gateway to ClusterIP
api-gateway: ClusterIP

# 2. Add Ingress for all external access
Ingress:
  - api.demo-micro.com/graphql → api-gateway
  - api.demo-micro.com/orders → order-service
  - api.demo-micro.com/inventory → inventory-service

# 3. Keep everything else as ClusterIP
order-service: ClusterIP
inventory-service: ClusterIP
notification-service: ClusterIP
databases: ClusterIP
```

**Benefits:**

- ✅ Single load balancer ($50/mo vs $200/mo)
- ✅ Proper SSL/TLS
- ✅ Clean API structure
- ✅ Professional setup

## Next Steps

Would you like me to:

1. ✅ Create an Ingress configuration for your demo-micro project?
2. ✅ Set up NGINX Ingress Controller in Minikube?
3. ✅ Show you how to configure SSL with cert-manager?
4. ✅ Create a migration guide from NodePort → Ingress?

---

**Related Guides:**

- [CLUSTERIP-EXPLAINED.md](./CLUSTERIP-EXPLAINED.md) - Deep dive into ClusterIP
- [LOADBALANCER-VS-NODEPORT.md](./LOADBALANCER-VS-NODEPORT.md) - Service types comparison
- [SERVICE-TYPES-COMPLETE-GUIDE.md](./SERVICE-TYPES-COMPLETE-GUIDE.md) - Visual guide to all service types
