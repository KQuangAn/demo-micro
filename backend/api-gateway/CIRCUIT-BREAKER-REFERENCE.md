# Circuit Breaker Pattern - Quick Reference

Imagine this scenario without a circuit breaker:
Order Service goes down ❌
↓
API Gateway still sends requests
↓
Each request waits 30-60 seconds for timeout ⏳
↓
100 concurrent users = 100 hanging threads 🔥
↓
Gateway runs out of resources
↓
Entire system crashes 💥 (Cascade Failure)
With Circuit Breaker
Order Service goes down ❌
↓
Circuit Breaker detects 5 failures
↓
Circuit OPENS - stops sending requests 🛑
↓
Returns 503 immediately (0 seconds, not 60!)
↓
Gateway stays healthy ✅
↓
After 60s, circuit tries again (Half-Open)
↓
Service recovered? Close circuit, resume normal ✅
Service still down? Keep circuit open 🛑

## State Machine

```
        ┌─────────────┐
        │   CLOSED    │
        │  (Normal)   │
        └─────┬───────┘
              │
    [5 failures detected]
              ↓
        ┌─────────────┐
        │    OPEN     │
        │  (Failing)  │
        └─────┬───────┘
              │
    [60s timeout passed]
              ↓
        ┌─────────────┐
        │ HALF-OPEN   │
        │  (Testing)  │
        └─────┬───────┘
              │
     ┌────────┴────────┐
     │                 │
[3 success]      [1 failure]
     ↓                 ↓
 ┌─────────┐     ┌─────────┐
 │ CLOSED  │     │  OPEN   │
 └─────────┘     └─────────┘
```

## Configuration Comparison

| Parameter               | API Gateway | Subgraph |
| ----------------------- | ----------- | -------- |
| MaxFailures             | 5           | 3        |
| Timeout                 | 60s         | 30s      |
| MaxRequests (half-open) | 3           | 2        |
| ResetTimeout            | 30s         | 20s      |
| FailureThreshold        | 50%         | 60%      |

## Error Responses

### Circuit Open

```json
{
  "errors": [
    {
      "message": "Service temporarily unavailable - circuit breaker is open",
      "extensions": {
        "code": "CIRCUIT_BREAKER_OPEN",
        "circuit_state": "open",
        "failure_count": 5,
        "retry_after": 60
      }
    }
  ]
}
```

**HTTP Status:** 503 Service Unavailable  
**Headers:** `X-Circuit-Breaker-State: open`, `Retry-After: 60`

### Half-Open (Too Many Requests)

```json
{
  "errors": [
    {
      "message": "Too many requests - circuit breaker is in recovery mode",
      "extensions": {
        "code": "CIRCUIT_BREAKER_HALF_OPEN",
        "retry_after": 5
      }
    }
  ]
}
```

**HTTP Status:** 429 Too Many Requests  
**Headers:** `X-Circuit-Breaker-State: half-open`, `Retry-After: 5`

## Quick Test Commands

### 1. Check Health

```bash
curl http://localhost:8080/health/circuit-breakers | jq
```

### 2. Trigger Circuit Break

```bash
# Stop a service
kubectl scale deployment/order-service --replicas=0 -n demo-micro

# Send 10 requests to trigger breaker
for i in {1..10}; do
  curl -X POST http://localhost:8080/query \
    -H "Content-Type: application/json" \
    -d '{"query": "{ orders { id } }"}'
  sleep 1
done
```

### 3. Monitor State Changes

```bash
# Watch logs
kubectl logs -f -l app=api-gateway -n demo-micro | grep -i "circuit"

# Check Redis
kubectl exec -it redis-statefulset-0 -n demo-micro -- redis-cli
> GET circuit:subgraph-order:state
> GET circuit:subgraph-order:failures
```

### 4. Test Recovery

```bash
# Restore service
kubectl scale deployment/order-service --replicas=1 -n demo-micro

# Wait for timeout (60s) then send requests
sleep 60
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"query": "{ orders { id } }"}'
```

## Redis Keys

```
circuit:api-gateway:state              # Main gateway state
circuit:api-gateway:failures           # Failure count
circuit:subgraph-order:state           # Order service state
circuit:subgraph-order:failures        # Order failures
circuit:subgraph-inventory:state       # Inventory state
circuit:subgraph-notification:state    # Notification state
```

## Benefits at a Glance

✅ **Prevents Cascade Failures** - Isolates failing services  
✅ **Fast Failure** - Returns 503 immediately (no timeout wait)  
✅ **Auto Recovery** - Detects when services recover  
✅ **Resource Protection** - Stops wasting calls to dead services  
✅ **Per-Service Isolation** - Independent breakers for each subgraph  
✅ **Graceful Degradation** - Serve partial data from healthy services

## Common Scenarios

### Scenario 1: Subgraph Down

1. Subgraph starts failing
2. After 3 failures → Circuit OPENS
3. Gateway fails fast with 503
4. After 30s → Circuit goes HALF-OPEN
5. Test requests succeed → Circuit CLOSES
6. Normal operation resumes

### Scenario 2: Temporary Network Glitch

1. Network hiccup causes 2 failures
2. Circuit stays CLOSED (< 3 failures)
3. Next request succeeds
4. Failure count resets to 0
5. No circuit break triggered

### Scenario 3: Slow Service (Timeout)

1. Service responds slowly (timeout)
2. Counts as failure
3. After 3 timeouts → Circuit OPENS
4. Protects gateway from waiting
5. Tests recovery automatically

## Integration with Other Features

```
Circuit Breaker + Cache:
- Circuit opens → Serve stale cache if available
- Prevents total failure

Circuit Breaker + Rate Limiting:
- Both work independently
- Rate limit first, then circuit breaker

Circuit Breaker + Fallback:
- Circuit opens → Use fallback schema
- Maintains service during outages
```
