# Kafka on Kubernetes - Quick Reference

## 🎯 What's Included

The Kafka stack includes:

1. **Zookeeper** - Coordination service for Kafka (StatefulSet)
2. **Kafka** - Message broker (StatefulSet)
3. **Kafdrop** - Web UI for Kafka (Deployment)
4. **Schema Registry** - Schema management for Kafka messages (Deployment)

## 📦 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Kafka Stack                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                       │
│  │  Zookeeper   │  ← Coordination & Configuration      │
│  │ StatefulSet  │                                       │
│  │  Port: 2181  │                                       │
│  └──────┬───────┘                                       │
│         │                                                │
│  ┌──────▼───────┐                                       │
│  │    Kafka     │  ← Message Broker                    │
│  │ StatefulSet  │                                       │
│  │  Port: 9092  │                                       │
│  │  Port: 29092 │                                       │
│  └──────┬───────┘                                       │
│         │                                                │
│    ┌────┴────┬──────────────┐                          │
│    │         │              │                           │
│  ┌─▼────┐  ┌─▼────────┐  ┌─▼───────────┐              │
│  │Kafdrop│  │ Schema   │  │ Your Apps   │              │
│  │WebUI  │  │ Registry │  │ (producers/ │              │
│  │:30900 │  │  :8081   │  │  consumers) │              │
│  └───────┘  └──────────┘  └─────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Deploy Kafka Stack

```bash
# Deploy as part of full deployment
cd k8s
./deploy.sh
# Answer 'y' when prompted for Kafka stack

# Or deploy manually
kubectl apply -f k8s/kafka-stack.yaml
```

### Check Status

```bash
# Check all Kafka components
kubectl get pods -n demo-micro | grep -E '(kafka|zookeeper)'

# Check Zookeeper
kubectl get pods -n demo-micro -l app=zookeeper

# Check Kafka
kubectl get pods -n demo-micro -l app=kafka

# Check services
kubectl get svc -n demo-micro | grep -E '(kafka|zookeeper)'
```

### View Logs

```bash
# Zookeeper logs
kubectl logs -f statefulset/zookeeper -n demo-micro

# Kafka logs
kubectl logs -f statefulset/kafka -n demo-micro

# Kafdrop logs
kubectl logs -f deployment/kafdrop -n demo-micro
```

## 🌐 Access Services

### Kafdrop (Web UI)

Access Kafka Web UI at:

- **NodePort**: http://localhost:30900
- **Port Forward**:
  ```bash
  kubectl port-forward svc/kafdrop 9000:9000 -n demo-micro
  ```
  Then open: http://localhost:9000

### Kafka (Internal)

From within the cluster:

- **Internal**: `kafka:29092`
- **External**: `kafka:9092`

### Kafka (External - NodePort)

From your host machine:

- **NodePort**: `localhost:30092`

### Schema Registry

From within the cluster:

- **Endpoint**: `http://schema-registry:8081`

## 📝 Common Operations

### Create a Topic

```bash
# Exec into Kafka pod
kubectl exec -it kafka-0 -n demo-micro -- bash

# Create topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic my-topic \
  --partitions 3 \
  --replication-factor 1

# List topics
kafka-topics --list --bootstrap-server localhost:9092

# Describe topic
kafka-topics --describe \
  --bootstrap-server localhost:9092 \
  --topic my-topic
```

### Produce Messages

```bash
# Exec into Kafka pod
kubectl exec -it kafka-0 -n demo-micro -- bash

# Start producer
kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic my-topic

# Type messages and press Enter
# Press Ctrl+C to exit
```

### Consume Messages

```bash
# Exec into Kafka pod
kubectl exec -it kafka-0 -n demo-micro -- bash

# Start consumer (from beginning)
kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic my-topic \
  --from-beginning

# Start consumer (latest messages only)
kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic my-topic

# Press Ctrl+C to exit
```

### Check Consumer Groups

```bash
kubectl exec -it kafka-0 -n demo-micro -- bash

# List consumer groups
kafka-consumer-groups --list --bootstrap-server localhost:9092

# Describe consumer group
kafka-consumer-groups --describe \
  --bootstrap-server localhost:9092 \
  --group my-consumer-group
```

## 🔧 Connect from Your Application

### From Pods in the Same Namespace

```yaml
# Environment variable
KAFKA_BOOTSTRAP_SERVERS: "kafka:29092"

# Or in your application code:
bootstrap_servers = "kafka:29092"
```

### Example Producer (Python)

```python
from kafka import KafkaProducer

producer = KafkaProducer(
    bootstrap_servers='kafka:29092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

producer.send('my-topic', {'key': 'value'})
producer.flush()
```

### Example Consumer (Python)

```python
from kafka import KafkaConsumer

consumer = KafkaConsumer(
    'my-topic',
    bootstrap_servers='kafka:29092',
    group_id='my-consumer-group',
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

for message in consumer:
    print(f"Received: {message.value}")
```

### Example Producer (Go)

```go
import "github.com/segmentio/kafka-go"

writer := kafka.NewWriter(kafka.WriterConfig{
    Brokers: []string{"kafka:29092"},
    Topic:   "my-topic",
})

writer.WriteMessages(context.Background(),
    kafka.Message{
        Key:   []byte("key"),
        Value: []byte("value"),
    },
)
```

### Example Consumer (Node.js)

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['kafka:29092'],
});

const consumer = kafka.consumer({ groupId: 'my-group' });

await consumer.connect();
await consumer.subscribe({ topic: 'my-topic' });

await consumer.run({
  eachMessage: async ({ message }) => {
    console.log({
      value: message.value.toString(),
    });
  },
});
```

## 📊 Monitoring

### Check Kafka Metrics

```bash
# Get pod resource usage
kubectl top pod kafka-0 -n demo-micro
kubectl top pod zookeeper-0 -n demo-micro

# Check events
kubectl get events -n demo-micro --field-selector involvedObject.name=kafka-0
```

### Use Kafdrop for Visual Monitoring

Open Kafdrop at http://localhost:30900 to:

- ✅ View all topics
- ✅ See message counts
- ✅ Browse messages
- ✅ View consumer groups
- ✅ Monitor broker health

## 🔍 Troubleshooting

### Kafka Won't Start

```bash
# Check Zookeeper is running first
kubectl get pods -n demo-micro -l app=zookeeper

# Check Kafka logs
kubectl logs kafka-0 -n demo-micro

# Check Zookeeper logs
kubectl logs zookeeper-0 -n demo-micro

# Describe pod for events
kubectl describe pod kafka-0 -n demo-micro
```

### Connection Issues

```bash
# Test Zookeeper connection from Kafka pod
kubectl exec -it kafka-0 -n demo-micro -- nc -zv zookeeper 2181

# Check Kafka is listening
kubectl exec -it kafka-0 -n demo-micro -- netstat -tuln | grep 9092

# Test from another pod
kubectl run test --rm -it --image=busybox -n demo-micro -- telnet kafka 29092
```

### PVC Issues

```bash
# Check PVCs are bound
kubectl get pvc -n demo-micro | grep -E '(kafka|zookeeper)'

# Check PV status
kubectl get pv | grep demo-micro
```

## 📈 Scaling Kafka

### Scale to Multiple Brokers

```bash
# Scale Kafka to 3 brokers
kubectl scale statefulset kafka --replicas=3 -n demo-micro

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=kafka -n demo-micro --timeout=300s

# Check all brokers
kubectl get pods -n demo-micro -l app=kafka
```

**Note**: When scaling to multiple brokers, update:

- `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR`
- `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR`
- Topic replication factors

## 🗑️ Cleanup

### Delete Kafka Stack

```bash
# Delete all Kafka resources
kubectl delete -f k8s/kafka-stack.yaml

# Or delete specific components
kubectl delete statefulset kafka -n demo-micro
kubectl delete statefulset zookeeper -n demo-micro
kubectl delete deployment kafdrop -n demo-micro
kubectl delete deployment schema-registry -n demo-micro
```

### Delete PVCs (Data Loss!)

```bash
# Warning: This deletes all data!
kubectl delete pvc kafka-data-pvc -n demo-micro
kubectl delete pvc zookeeper-data-pvc -n demo-micro
kubectl delete pvc zookeeper-log-pvc -n demo-micro
```

## 🔒 Production Considerations

For production deployments:

1. **High Availability**

   - Run 3+ Zookeeper instances
   - Run 3+ Kafka brokers
   - Set replication factor ≥ 3

2. **Resource Limits**

   - Increase memory for Kafka (2-4GB)
   - Increase CPU for high throughput
   - Use SSD-backed storage

3. **Security**

   - Enable SSL/TLS
   - Configure SASL authentication
   - Use network policies

4. **Monitoring**

   - Deploy Prometheus + Grafana
   - Use JMX exporters
   - Set up alerts

5. **Backup**
   - Regular PVC snapshots
   - Mirror maker for replication
   - Topic configuration backup

## 📚 Additional Resources

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Confluent Platform](https://docs.confluent.io/)
- [Kafdrop GitHub](https://github.com/obsidiandynamics/kafdrop)
- [Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html)

## 🎯 Quick Commands Cheatsheet

```bash
# Check status
kubectl get pods -n demo-micro | grep -E '(kafka|zookeeper)'

# Access Kafdrop
open http://localhost:30900

# Kafka shell
kubectl exec -it kafka-0 -n demo-micro -- bash

# Create topic
kubectl exec -it kafka-0 -n demo-micro -- kafka-topics --create --bootstrap-server localhost:9092 --topic test --partitions 3 --replication-factor 1

# List topics
kubectl exec -it kafka-0 -n demo-micro -- kafka-topics --list --bootstrap-server localhost:9092

# Produce test message
kubectl exec -it kafka-0 -n demo-micro -- bash -c "echo 'test message' | kafka-console-producer --bootstrap-server localhost:9092 --topic test"

# Consume messages
kubectl exec -it kafka-0 -n demo-micro -- kafka-console-consumer --bootstrap-server localhost:9092 --topic test --from-beginning --max-messages 10

# Check logs
kubectl logs -f kafka-0 -n demo-micro
kubectl logs -f zookeeper-0 -n demo-micro
```

---

**Your Kafka stack is now ready to use! 🎉**
