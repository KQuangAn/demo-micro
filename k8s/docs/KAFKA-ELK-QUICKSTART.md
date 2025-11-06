# Kafka-ELK Integration Quick Start

## 🚀 Quick Deployment

### Prerequisites
- Kubernetes cluster running (Docker Desktop or Minikube)
- kubectl configured and connected

### Deploy Everything

```bash
cd k8s/scripts
./deploy.sh --all
```

This will deploy:
1. Namespace and secrets
2. Infrastructure (Redis, LocalStack)
3. **Kafka** (Zookeeper, Kafka broker, Kafdrop UI)
4. **ELK Stack** (Elasticsearch, Logstash with Kafka input, Kibana)
5. Databases (PostgreSQL, MongoDB)
6. Microservices (Order, Inventory, Notification)
7. API Gateway

### Deploy Only Kafka and ELK

```bash
cd k8s/scripts
./deploy.sh --kafka --elk
```

## ✅ Verification Steps

### 1. Check All Pods are Running

```bash
kubectl get pods -n demo-micro
```

**Expected output:**
```
NAME                                   READY   STATUS    RESTARTS   AGE
elasticsearch-0                        1/1     Running   0          2m
kafka-0                                1/1     Running   0          3m
kibana-xxxxx                           1/1     Running   0          2m
logstash-xxxxx                         1/1     Running   0          2m
zookeeper-0                            1/1     Running   0          3m
...
```

### 2. Verify Logstash is Connected to Kafka

```bash
# Check Logstash logs
kubectl logs -f deployment/logstash -n demo-micro

# Look for these messages:
# ✓ "Starting Logstash"
# ✓ "Successfully started Logstash API"
# ✓ Successfully connected to Kafka
```

### 3. Check Kafka Topics

```bash
# Access Kafdrop UI
kubectl port-forward service/kafdrop 9000:9000 -n demo-micro
```

Open browser: http://localhost:9000

You should see topics:
- `order.events`
- `inventory.events`
- `notification.events`

### 4. Generate Test Events

```bash
# Port forward to API Gateway
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro

# Create a test order (this will generate events in Kafka)
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createOrder(input: { customerId: 1, items: [{productId: 1, quantity: 2}] }) { id status } }"
  }'
```

### 5. Verify Events in Elasticsearch

```bash
# Port forward to Elasticsearch
kubectl port-forward service/elasticsearch 9200:9200 -n demo-micro

# Check indices (you should see microservices-YYYY.MM.DD)
curl -u elastic:changeme http://localhost:9200/_cat/indices?v

# Search for events
curl -u elastic:changeme http://localhost:9200/microservices-*/_search?pretty

# Count events
curl -u elastic:changeme http://localhost:9200/microservices-*/_count?pretty
```

### 6. View Events in Kibana

```bash
# Port forward to Kibana
kubectl port-forward service/kibana 5601:5601 -n demo-micro
```

Open browser: http://localhost:5601
- **Username**: `elastic`
- **Password**: `changeme`

**First Time Setup:**
1. Go to **Management** → **Stack Management** → **Index Patterns**
2. Click **Create index pattern**
3. Enter: `microservices-*`
4. Select timestamp field: `@timestamp`
5. Click **Create**

**View Data:**
1. Go to **Discover**
2. Select `microservices-*` index pattern
3. You should see events flowing in real-time!

## 🎯 Quick Verification Checklist

- [ ] All pods are running
- [ ] Logstash logs show Kafka connection
- [ ] Kafka topics exist (visible in Kafdrop)
- [ ] Test event generated successfully
- [ ] Index created in Elasticsearch (`microservices-*`)
- [ ] Events visible in Kibana Discover

## 🔍 Quick Debugging

### If Logstash pod is not running:

```bash
kubectl describe pod -l app=logstash -n demo-micro
```

### If no data in Elasticsearch:

```bash
# Check if microservices are producing events
kubectl logs deployment/order-service -n demo-micro | grep -i kafka

# Check Kafka consumer group
kubectl exec -it kafka-0 -n demo-micro -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group logstash-consumer-group --describe
```

### If Kibana can't connect to Elasticsearch:

```bash
# Check Kibana logs
kubectl logs deployment/kibana -n demo-micro

# Check Elasticsearch health
kubectl exec -it elasticsearch-0 -n demo-micro -- \
  curl -u elastic:changeme http://localhost:9200/_cluster/health?pretty
```

## 📊 Useful Queries in Kibana

Once your index pattern is set up, try these queries in **Discover**:

### View Order Events
```
service_name: "order"
```

### View Inventory Events
```
service_name: "inventory"
```

### View Events from Last Hour
```
@timestamp: [now-1h TO now]
```

### View Error Events
```
level: "ERROR" OR status: "error"
```

## 🌐 Service URLs

After deployment, access these services:

| Service | URL | Purpose |
|---------|-----|---------|
| API Gateway | http://localhost:30080 | GraphQL API |
| Kibana | http://localhost:30561 | Log visualization |
| Kafdrop | http://localhost:30900 | Kafka UI |
| Elasticsearch | http://localhost:9200 (via port-forward) | Search API |
| Logstash | http://localhost:9600 (via port-forward) | Logstash API |

## 📚 Next Steps

1. **Create Visualizations**: See full guide in `KAFKA-ELK-INTEGRATION.md`
2. **Set up Dashboards**: Create custom dashboards for your services
3. **Configure Alerts**: Set up alerts for error events
4. **Optimize Performance**: Tune Logstash and Elasticsearch settings

## 🆘 Need Help?

- Full documentation: `k8s/docs/KAFKA-ELK-INTEGRATION.md`
- Kafka guide: `k8s/docs/KAFKA-GUIDE.md`
- General help: `k8s/docs/README.md`

## 🧹 Cleanup

```bash
cd k8s/scripts
./undeploy.sh
```

This will remove all resources from the `demo-micro` namespace.

