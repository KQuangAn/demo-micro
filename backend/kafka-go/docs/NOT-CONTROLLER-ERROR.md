# Fix: Kafka "Not Controller" Error

## Problem
When creating Kafka topics, you may encounter:
```
[41] Not Controller: this is not the correct controller for this cluster
```

## Root Cause
In a Kafka cluster with multiple brokers, only **one broker is the controller** at any time. The controller is responsible for:
- Creating topics
- Deleting topics
- Managing partition assignments
- Handling broker failures

When you try to create/delete a topic on a non-controller broker, Kafka returns this error.

## Solution
The fixed code now **tries all brokers** until it finds the controller:

```go
func CreateTopic(ctx context.Context, brokers []string, config TopicConfig) error {
    var lastErr error
    
    for _, broker := range brokers {
        conn, err := kafka.DialContext(ctx, "tcp", broker)
        // ... connection logic ...
        
        err = conn.CreateTopics(topicConfigs...)
        
        if err != nil {
            // If it's a "Not Controller" error, try next broker
            if isNotControllerError(err) {
                log.Printf("Broker %s is not the controller, trying next broker...", broker)
                lastErr = err
                continue  // Try next broker
            }
            return fmt.Errorf("failed to create topic on %s: %w", broker, err)
        }
        
        return nil  // Success!
    }
    
    return fmt.Errorf("failed to create topic after trying all brokers: %w", lastErr)
}
```

## How It Works

1. **Try broker 1** (localhost:9092)
   - ❌ Not controller → try next

2. **Try broker 2** (localhost:9093)
   - ❌ Not controller → try next

3. **Try broker 3** (localhost:9094)
   - ✅ Controller found! → Create topic

## Example Output

```bash
$ go run cmd/topic-manager/main.go -action=create -topic=orders.events

2025/10/29 17:21:55 Broker localhost:9092 is not the controller, trying next broker...
2025/10/29 17:21:55 Broker localhost:9093 is not the controller, trying next broker...
2025/10/29 17:21:55 Topic 'orders.events' created successfully (partitions=3, replication=3)
✅ Topic 'orders.events' created successfully
```

## Prevention
This error is now **automatically handled** - the code will:
1. Try all brokers in sequence
2. Find the controller automatically
3. Create the topic on the correct broker

## Alternative: Find Controller Manually

If you want to know which broker is the controller:

```bash
# Using kafka CLI inside container
docker exec -it kafka-go-kafka-1-1 kafka-metadata --bootstrap-server localhost:9092 --describe --all | grep controller
```

## Best Practices

✅ **Always provide multiple brokers** in your connection list  
✅ **Let the client library retry** across brokers  
✅ **Use all broker addresses** in your configuration  

❌ Don't hardcode a single broker  
❌ Don't assume broker 1 is always the controller  
❌ Don't retry on the same broker multiple times  

## Testing

```bash
# Create topic
make topic-create TOPIC=test-topic

# List topics (verify creation)
make topic-list

# Delete topic
make topic-delete TOPIC=test-topic
```

All these commands now work correctly with the fix! 🎉
