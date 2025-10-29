# Kafka Topic Management Guide

## 🎯 Quick Start

### Method 1: Using the Main App (Auto-create)

The main application now **automatically creates** the topic if it doesn't exist:

```bash
make run
# or
go run cmd/app/main.go
```

The topic will be created with:

- **3 partitions**
- **Replication factor of 3**

---

## 🛠️ Method 2: Using Makefile Commands

### List All Topics

```bash
make topic-list
```

### Create a Topic

```bash
make topic-create TOPIC=my-topic
```

### Delete a Topic

```bash
make topic-delete TOPIC=my-topic
```

---

## 🔧 Method 3: Using the Topic Manager CLI

Build the tool:

```bash
go build -o bin/topic-manager cmd/topic-manager/main.go
```

### Create a Topic

```bash
./bin/topic-manager -action=create -topic=my-topic -partitions=3 -replication=3
```

### List Topics

```bash
./bin/topic-manager -action=list
```

### Delete a Topic

```bash
./bin/topic-manager -action=delete -topic=my-topic
```

### Custom Brokers

```bash
./bin/topic-manager -action=list -brokers="localhost:9092,localhost:9093"
```

---

## 🐳 Method 4: Using Docker/Kafdrop UI

1. Start Kafka cluster:

```bash
make docker-up
```

2. Open Kafdrop UI:

```
http://localhost:9000
```

3. Use the web interface to:
   - View topics
   - Create topics
   - View messages

---

## 📝 Method 5: Using Kafka CLI (Inside Container)

```bash
# Enter Kafka container
docker exec -it kafka-go-kafka-1-1 bash

# Create topic
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic my-topic \
  --partitions 3 \
  --replication-factor 3

# List topics
kafka-topics --list --bootstrap-server localhost:9092

# Describe topic
kafka-topics --describe --bootstrap-server localhost:9092 --topic my-topic

# Delete topic
kafka-topics --delete --bootstrap-server localhost:9092 --topic my-topic
```

---

## 🎨 Method 6: Programmatically in Your Code

```go
package main

import (
    "context"
    "github.com/demo-micro/backend/kafka-go/internal/providers/kafka"
)

func main() {
    ctx := context.Background()
    brokers := []string{"localhost:9092", "localhost:9093", "localhost:9094"}

    // Create topic
    err := kafka.CreateTopic(ctx, brokers, kafka.TopicConfig{
        Topic:             "my-topic",
        NumPartitions:     3,
        ReplicationFactor: 3,
    })
    if err != nil {
        panic(err)
    }

    // List topics
    topics, err := kafka.ListTopics(ctx, brokers)
    if err != nil {
        panic(err)
    }
    println(topics)
}
```

---

## ⚙️ Configuration

### Topic Parameters

| Parameter             | Description          | Recommended          |
| --------------------- | -------------------- | -------------------- |
| **NumPartitions**     | Number of partitions | 3+ (for parallelism) |
| **ReplicationFactor** | Number of replicas   | 3 (for 3 brokers)    |

### Best Practices

✅ **Replication Factor**: Should be ≤ number of brokers  
✅ **Partitions**: More partitions = more parallelism  
✅ **Naming**: Use descriptive names (e.g., `user-events`, `order-processing`)  
❌ **Don't**: Create too many topics (impacts performance)

---

## 🚨 Troubleshooting

### Topic Already Exists

The `CreateTopic` function checks if the topic exists and won't error if it already exists.

### Connection Refused

Make sure Kafka is running:

```bash
make docker-up
docker-compose ps
```

### Replication Factor Error

If you get "replication factor larger than available brokers", reduce the replication factor:

```bash
make topic-create TOPIC=test -replication=1
```

---

## 📊 Full Workflow Example

```bash
# 1. Start Kafka cluster
make docker-up

# 2. List existing topics
make topic-list

# 3. Create a new topic
make topic-create TOPIC=orders

# 4. Run the application (uses the topic)
make run

# 5. View in Kafdrop
open http://localhost:9000

# 6. Clean up
make topic-delete TOPIC=orders
make docker-down
```

---

## 🎯 Recommended Approach

For **development**: Use `make run` - topics are auto-created  
For **production**: Pre-create topics with proper configuration  
For **debugging**: Use Kafdrop UI at http://localhost:9000
