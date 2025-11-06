# Kafka-ELK Integration Guide

## 📋 Overview

This guide explains how Kafka is integrated with the ELK (Elasticsearch, Logstash, Kibana) stack in the Demo Micro project to provide centralized logging and event monitoring for all microservices.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Microservices Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐             │
│  │  Order   │  │Inventory │  │ Notification │             │
│  │ Service  │  │ Service  │  │   Service    │             │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘             │
└───────┼─────────────┼────────────────┼──────────────────────┘
        │             │                │
        │ Produce     │ Produce        │ Produce
        │ Events      │ Events         │ Events
        ▼             ▼                ▼
┌──────────────────────────────────────────────────────────────┐
│                      Apache Kafka                             │
│  Topics: order.events, inventory.events, notification.events │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Consume (Logstash Kafka Input Plugin)
                         ▼
                  ┌──────────────┐
                  │   Logstash   │
                  │  (Filtering  │
                  │   Parsing)   │
                  └──────┬───────┘
                         │
                         │ Index
                         ▼
                  ┌──────────────┐
                  │Elasticsearch │
                  │   (Storage)  │
                  └──────┬───────┘
                         │
                         │ Query/Visualize
                         ▼
                  ┌──────────────┐
                  │    Kibana    │
                  │     (UI)     │
                  └──────────────┘
```

## 🔧 Components

### 1. Kafka Topics

The following Kafka topics are consumed by Logstash:

- **order.events** - Order service events (creation, updates, status changes)
- **inventory.events** - Inventory service events (stock updates, reservations)
- **notification.events** - Notification service events (email/SMS notifications)

### 2. Logstash Configuration

**Location:** `k8s/infrastructure/elk/logstash-configmap.yaml`

#### Input Configuration

```ruby
kafka {
  bootstrap_servers => "kafka:29092"
  topics => ["order.events", "inventory.events", "notification.events"]
  group_id => "logstash-consumer-group"
  codec => json
  consumer_threads => 3
  decorate_events => true
  auto_offset_reset => "earliest"
  metadata_fields => ["timestamp", "topic", "partition", "offset"]
}
```

**Key Settings:**
- `bootstrap_servers`: Kafka broker address within Kubernetes cluster
- `group_id`: Consumer group for offset management
- `consumer_threads`: Number of parallel consumers (3 for better throughput)
- `auto_offset_reset`: Start from earliest message on first run
- `decorate_events`: Add Kafka metadata to events

#### Filter Configuration

The filter pipeline enriches and transforms events:

1. **JSON Parsing** - Parses JSON message strings
2. **Timestamp Parsing** - Converts event timestamps to Elasticsearch format
3. **Service Tagging** - Adds service name from Kafka topic
4. **Metadata Extraction** - Extracts Kafka partition and offset information
5. **Environment Tagging** - Adds environment and platform tags

#### Output Configuration

```ruby
elasticsearch {
  hosts => ["elasticsearch:9200"]
  user => "elastic"
  password => "${ELASTIC_PASSWORD}"
  index => "microservices-%{+YYYY.MM.dd}"
  manage_template => true
  template_name => "microservices"
  template_overwrite => true
}
```

Events are indexed in daily indices: `microservices-YYYY.MM.DD`

### 3. Kubernetes Resources

#### Logstash Deployment

**Features:**
- **Init Containers**: Waits for Kafka and Elasticsearch to be ready
- **Health Checks**: Liveness and readiness probes on port 9600
- **Resource Limits**: 768Mi-1536Mi memory, 500m-1000m CPU
- **ConfigMap Mount**: Pipeline configuration from ConfigMap

#### Logstash Service

**Exposed Ports:**
- **5044**: Beats input (for Filebeat, Metricbeat)
- **50000**: TCP input (for direct log streaming)
- **9600**: HTTP API (for monitoring and health checks)

## 📦 Deployment

### Step 1: Apply ConfigMap

```bash
kubectl apply -f k8s/infrastructure/elk/logstash-configmap.yaml
```

### Step 2: Deploy ELK Stack

```bash
kubectl apply -f k8s/infrastructure/elk/elk-stack.yaml
```

### Step 3: Verify Deployment

```bash
# Check if all pods are running
kubectl get pods -n demo-micro | grep -E 'elasticsearch|logstash|kibana'

# Check Logstash logs for Kafka connection
kubectl logs -f deployment/logstash -n demo-micro

# Expected output:
# "Successfully connected to Kafka broker kafka:29092"
# "Starting to consume from topics: [order.events, inventory.events, notification.events]"
```

## 🔍 Monitoring & Verification

### 1. Check Kafka Topics

```bash
# Port forward to Kafdrop UI
kubectl port-forward service/kafdrop 9000:9000 -n demo-micro

# Open browser: http://localhost:9000
# View topics and messages
```

### 2. Check Logstash Status

```bash
# View Logstash logs
kubectl logs -f deployment/logstash -n demo-micro

# Check Logstash API
kubectl port-forward service/logstash 9600:9600 -n demo-micro
curl http://localhost:9600/_node/stats/pipelines

# Check consumer group in Kafka
kubectl exec -it kafka-0 -n demo-micro -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group logstash-consumer-group --describe
```

### 3. Verify Data in Elasticsearch

```bash
# Port forward to Elasticsearch
kubectl port-forward service/elasticsearch 9200:9200 -n demo-micro

# Check indices
curl -u elastic:changeme http://localhost:9200/_cat/indices?v

# Search for events
curl -u elastic:changeme http://localhost:9200/microservices-*/_search?pretty

# Count documents
curl -u elastic:changeme http://localhost:9200/microservices-*/_count?pretty
```

### 4. Visualize in Kibana

```bash
# Port forward to Kibana
kubectl port-forward service/kibana 5601:5601 -n demo-micro

# Open browser: http://localhost:5601
# Login: elastic / changeme
```

**Create Index Pattern:**
1. Go to **Management** → **Stack Management** → **Index Patterns**
2. Click **Create index pattern**
3. Enter pattern: `microservices-*`
4. Select timestamp field: `@timestamp`
5. Click **Create index pattern**

**Explore Data:**
1. Go to **Discover**
2. Select `microservices-*` index pattern
3. View events in real-time
4. Filter by service: `service_name: order` or `service_name: inventory`

## 📊 Example Queries in Kibana

### All Order Events
```
service_name: "order"
```

### Failed Events
```
status: "error" OR level: "ERROR"
```

### Events from Specific Kafka Topic
```
service: "order.events"
```

### Events in Last Hour
```
@timestamp: [now-1h TO now]
```

### High Priority Events
```
priority: "high" AND service_name: "order"
```

## 🎯 Creating Visualizations

### 1. Event Count by Service

**Visualization Type:** Vertical Bar Chart

- **Metric:** Count
- **Buckets:** Terms aggregation on `service_name.keyword`

### 2. Event Timeline

**Visualization Type:** Line Chart

- **Metric:** Count
- **Buckets:** Date Histogram on `@timestamp`
- **Split Series:** Terms on `service_name.keyword`

### 3. Kafka Partition Distribution

**Visualization Type:** Pie Chart

- **Metric:** Count
- **Buckets:** Terms aggregation on `kafka_partition`

### 4. Top Error Messages

**Visualization Type:** Data Table

- **Metric:** Count
- **Buckets:** Terms on `error.keyword`
- **Filter:** `level: ERROR`

## 🚨 Troubleshooting

### Issue: Logstash Not Consuming from Kafka

**Check:**
```bash
# 1. Verify Kafka is running
kubectl get pods -n demo-micro | grep kafka

# 2. Check Logstash logs for errors
kubectl logs deployment/logstash -n demo-micro | grep -i error

# 3. Verify Kafka connectivity from Logstash pod
kubectl exec -it deployment/logstash -n demo-micro -- \
  nc -zv kafka 29092
```

**Common Causes:**
- Kafka not ready when Logstash starts → Init containers should prevent this
- Wrong bootstrap server address → Check ConfigMap
- Network policy blocking connection → Check NetworkPolicies

### Issue: No Data in Elasticsearch

**Check:**
```bash
# 1. Verify Logstash is receiving data
kubectl logs deployment/logstash -n demo-micro | grep -i "consumed"

# 2. Check if microservices are producing events
kubectl logs deployment/order-service -n demo-micro | grep -i kafka

# 3. Verify Elasticsearch connection
kubectl exec -it deployment/logstash -n demo-micro -- \
  curl -u elastic:changeme http://elasticsearch:9200/_cluster/health
```

**Common Causes:**
- No events being produced → Check microservice logs
- Elasticsearch authentication failure → Verify secret
- Index creation failure → Check Elasticsearch logs

### Issue: High Logstash Memory Usage

**Solutions:**
```bash
# 1. Reduce JVM heap size in deployment
LS_JAVA_OPTS: "-Xmx512m -Xms512m"

# 2. Reduce consumer threads
consumer_threads => 1

# 3. Increase resource limits
kubectl edit deployment logstash -n demo-micro
```

### Issue: Lag in Kafka Consumer Group

**Check:**
```bash
kubectl exec -it kafka-0 -n demo-micro -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group logstash-consumer-group --describe
```

**Solutions:**
- Increase `consumer_threads` in Logstash configuration
- Increase Logstash pod replicas
- Optimize filter pipeline
- Increase Elasticsearch bulk size

## 🔐 Security Considerations

### 1. Elasticsearch Authentication

The integration uses basic authentication:
- **Username**: `elastic`
- **Password**: Stored in `elasticsearch-secret`

**Production Recommendation:**
- Use strong passwords
- Enable TLS/SSL
- Use API keys instead of passwords
- Implement role-based access control (RBAC)

### 2. Kafka Security

Current setup uses PLAINTEXT protocol (no encryption).

**Production Recommendation:**
- Enable SASL authentication
- Enable SSL/TLS encryption
- Use ACLs to restrict topic access
- Separate consumer groups per service

### 3. Network Policies

Implement NetworkPolicies to restrict communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: logstash-network-policy
  namespace: demo-micro
spec:
  podSelector:
    matchLabels:
      app: logstash
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: filebeat
      ports:
        - protocol: TCP
          port: 5044
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: kafka
      ports:
        - protocol: TCP
          port: 29092
    - to:
        - podSelector:
            matchLabels:
              app: elasticsearch
      ports:
        - protocol: TCP
          port: 9200
```

## 📈 Performance Tuning

### Logstash Optimization

```yaml
# In logstash-configmap.yaml
input {
  kafka {
    # Increase for higher throughput
    consumer_threads => 5
    
    # Larger batch size
    max_poll_records => 500
    
    # Reduce polling interval
    poll_timeout_ms => 100
  }
}

# Environment variables in deployment
env:
  - name: PIPELINE_WORKERS
    value: "4"  # Increase for more parallelism
  - name: PIPELINE_BATCH_SIZE
    value: "250"  # Larger batches
  - name: PIPELINE_BATCH_DELAY
    value: "10"  # Lower delay
```

### Elasticsearch Optimization

```bash
# Increase bulk size
output {
  elasticsearch {
    bulk_size => 500
    flush_size => 100
  }
}
```

### Resource Scaling

```yaml
# Increase Logstash replicas
replicas: 3

# Increase resources
resources:
  requests:
    memory: '1Gi'
    cpu: '1000m'
  limits:
    memory: '2Gi'
    cpu: '2000m'
```

## 🧪 Testing the Integration

### 1. Generate Test Events

```bash
# Create a test order via API Gateway
kubectl port-forward service/api-gateway 8080:8080 -n demo-micro

# Send GraphQL mutation
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createOrder(input: { customerId: 1, items: [{productId: 1, quantity: 2}] }) { id status } }"
  }'
```

### 2. Verify in Kafka

```bash
# Access Kafdrop UI
kubectl port-forward service/kafdrop 9000:9000 -n demo-micro
# Open: http://localhost:9000
# Navigate to "order.events" topic and view messages
```

### 3. Verify in Elasticsearch

```bash
# Query Elasticsearch
kubectl port-forward service/elasticsearch 9200:9200 -n demo-micro

curl -u elastic:changeme \
  "http://localhost:9200/microservices-*/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "match": {
        "service_name": "order"
      }
    },
    "size": 10,
    "sort": [{"@timestamp": "desc"}]
  }'
```

### 4. View in Kibana

```bash
# Access Kibana
kubectl port-forward service/kibana 5601:5601 -n demo-micro
# Open: http://localhost:5601
# Go to Discover and search for recent events
```

## 📚 Additional Resources

- [Logstash Kafka Input Plugin](https://www.elastic.co/guide/en/logstash/current/plugins-inputs-kafka.html)
- [Elasticsearch Index API](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html)
- [Kibana Query Language (KQL)](https://www.elastic.co/guide/en/kibana/current/kuery-query.html)
- [Kafka Consumer Configuration](https://kafka.apache.org/documentation/#consumerconfigs)

## 🤝 Contributing

To add support for new topics:

1. Add topic name to the Logstash Kafka input configuration
2. Update filter rules if custom parsing is needed
3. Update this documentation
4. Test the integration end-to-end

## 📝 Changelog

### v1.0.0 (Current)
- Initial Kafka-ELK integration
- Support for order.events, inventory.events, notification.events
- Daily index rotation (microservices-YYYY.MM.DD)
- Basic authentication with Elasticsearch
- Health checks and init containers for reliability

