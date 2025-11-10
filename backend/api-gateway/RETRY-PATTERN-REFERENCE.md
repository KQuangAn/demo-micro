# Retry Pattern - Quick Reference

## Exponential Backoff Formula

```
delay = initialDelay × (multiplier ^ (attempt - 1))
delay = min(delay, maxDelay)
delay += random(-jitter × delay, +jitter × delay)
```

## Example Timeline

**Configuration:**
- InitialDelay: 100ms
- Multiplier: 2.0
- MaxDelay: 2s
- Jitter: 0.1 (10%)

**Execution:**
```
T=0ms      Attempt 1: Execute immediately
           ↓ FAIL (503 Service Unavailable)
           
T=0ms      Calculate backoff: 100ms × 2^0 = 100ms
           Add jitter: 100ms +/- 10ms = 90-110ms
           
T=105ms    Attempt 2: Execute after 105ms
           ↓ FAIL (502 Bad Gateway)
           
T=105ms    Calculate backoff: 100ms × 2^1 = 200ms
           Add jitter: 200ms +/- 20ms = 180-220ms
           
T=310ms    Attempt 3: Execute after 205ms more
           ↓ SUCCESS ✅
           
Total time: 310ms (vs 0ms instant failure)
Success rate improved from 0% to 100%!
```

## Configuration Comparison

| Parameter | API Gateway | Subgraph | Purpose |
|-----------|-------------|----------|---------|
| MaxAttempts | 3 | 2 | Total tries |
| InitialDelay | 100ms | 50ms | First retry delay |
| MaxDelay | 2s | 1s | Cap on delay |
| Multiplier | 2.0 | 2.0 | Growth rate |
| Jitter | 0.1 | 0.1 | Randomness (10%) |

## Retryable vs Non-Retryable Errors

### ✅ Retryable (Will Retry)
```
HTTP Status Codes:
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout
- 408 Request Timeout
- 429 Too Many Requests

Error Types:
- Network timeouts
- Connection refused
- Temporary unavailable
- Context deadline exceeded (if RetryOnTimeout=true)
```

### ❌ Non-Retryable (Fail Immediately)
```
- Circuit breaker is OPEN (no point retrying)
- 4xx client errors (except 408, 429)
- Context cancelled by client
- Non-retryable business logic errors
- 2xx success responses
```

## Metrics

### Check Retry Health
```bash
curl http://localhost:8080/health/retries | jq
```

**Response:**
```json
{
  "retry_metrics": {
    "api-gateway": {
      "name": "api-gateway",
      "total_attempts": 150,
      "successful_ops": 48,
      "failed_ops": 2,
      "success_rate": "96.00%",
      "avg_retries_per_op": "3.00"
    }
  }
}
```

### Redis Keys
```bash
redis-cli KEYS "retry:metrics:*"

# Output:
retry:metrics:api-gateway:attempts   # Total attempts
retry:metrics:api-gateway:success    # Successful operations
retry:metrics:api-gateway:failure    # Failed operations
```

### Calculate Metrics
```bash
# Get values
ATTEMPTS=$(redis-cli GET retry:metrics:api-gateway:attempts)
SUCCESS=$(redis-cli GET retry:metrics:api-gateway:success)
FAILURE=$(redis-cli GET retry:metrics:api-gateway:failure)

# Calculate success rate
echo "Success Rate: $(echo "scale=2; $SUCCESS / ($SUCCESS + $FAILURE) * 100" | bc)%"

# Calculate average retries
echo "Avg Retries: $(echo "scale=2; $ATTEMPTS / ($SUCCESS + $FAILURE)" | bc)"
```

## Integration with Circuit Breaker

### Flow Diagram
```
Request
  ↓
[Retry Middleware]
  ↓
Attempt 1 → [Circuit Breaker] → [Check State]
                                      ↓
                            ┌─────────┼─────────┐
                            ↓         ↓         ↓
                         CLOSED    OPEN    HALF-OPEN
                            ↓         ↓         ↓
                        Execute   Fail Fast  Test
                            ↓         ↓         ↓
                         FAIL      Return    FAIL
                            ↓       503         ↓
                         (retry)   (no retry)  (retry)
                            ↓                   ↓
                        Backoff             Backoff
                            ↓                   ↓
                        Attempt 2           Attempt 2
```

### Smart Retry Logic
```go
// Pseudo-code
func shouldRetry(err error, attempt int) bool {
    // Don't retry if circuit is open - no point
    if err == ErrCircuitOpen {
        log("Circuit open, stopping retries")
        return false
    }
    
    // Don't retry if max attempts reached
    if attempt >= maxAttempts {
        return false
    }
    
    // Retry on transient errors
    if isTransientError(err) {
        return true
    }
    
    return false
}
```

## Common Scenarios

### Scenario 1: Transient Network Glitch
```
T=0ms    Attempt 1 → Network timeout
T=100ms  Attempt 2 → Success ✅
Result: Request succeeded (vs failing immediately)
```

### Scenario 2: Service Rolling Update
```
T=0ms    Attempt 1 → Pod terminating (503)
T=100ms  Attempt 2 → Pod still terminating (503)
T=300ms  Attempt 3 → New pod ready → Success ✅
Result: Seamless deployment (user doesn't notice)
```

### Scenario 3: Service Completely Down
```
T=0ms    Attempt 1 → Failed (503)
T=100ms  Attempt 2 → Failed (503)
T=300ms  Attempt 3 → Failed (503)
         Circuit Breaker Opens 🔴
         Future requests fail fast (no retry needed)
Result: Fast failure after reasonable attempts
```

### Scenario 4: Rate Limited
```
T=0ms    Attempt 1 → 429 Too Many Requests
T=100ms  Attempt 2 → 429 Too Many Requests
T=300ms  Attempt 3 → 200 OK ✅
Result: Automatic backoff respects rate limits
```

## Best Practices

### ✅ DO
- Use exponential backoff to prevent overwhelming recovering services
- Add jitter to prevent thundering herd (synchronized retries)
- Set reasonable max delay (2-5 seconds)
- Track metrics to understand retry patterns
- Combine with circuit breaker for maximum resilience
- Retry idempotent operations safely

### ❌ DON'T
- Retry indefinitely (set max attempts)
- Use linear backoff (doesn't give service time to recover)
- Retry on client errors (4xx except 408, 429)
- Retry when circuit is open (waste of resources)
- Retry non-idempotent operations without safeguards

## Testing

### Test Transient Failure
```bash
# Kill a pod mid-request
kubectl delete pod -l app=order-service -n demo-micro &
sleep 0.1
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"query": "{ orders { id } }"}'

# Should succeed after retry
```

### Test Exponential Backoff
```bash
# Monitor timing
time curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"query": "{ orders { id } }"}'

# If retries:
# Attempt 1: 0ms
# Attempt 2: +100ms
# Attempt 3: +200ms
# Total: ~300ms
```

### Simulate Retry Metrics
```bash
# Send 100 requests
for i in {1..100}; do
  curl -X POST http://localhost:8080/query \
    -H "Content-Type: application/json" \
    -d '{"query": "{ orders { id } }"}'
done

# Check metrics
curl http://localhost:8080/health/retries | jq '.retry_metrics["api-gateway"]'
```

## Troubleshooting

### High Retry Rate
```bash
# Check average retries per operation
curl http://localhost:8080/health/retries | jq '.retry_metrics["api-gateway"].avg_retries_per_op'

# If > 2.0, investigate:
# - Are services unstable?
# - Is network flaky?
# - Are timeouts too aggressive?
```

### Low Success Rate
```bash
# Check success rate
curl http://localhost:8080/health/retries | jq '.retry_metrics["api-gateway"].success_rate'

# If < 90%, check:
# - Circuit breaker metrics (services down?)
# - Error logs (what's failing?)
# - Are max attempts too low?
```

### Thundering Herd Detection
```bash
# Check if requests are synchronized
kubectl logs -f -l app=order-service | grep "Request received" | awk '{print $1}' | uniq -c

# If you see spikes every 100ms/200ms:
# - Increase jitter (0.1 → 0.3)
# - Randomize initial delay
```

## Benefits Summary

| Benefit | Description | Impact |
|---------|-------------|--------|
| **Resilience** | Recover from transient failures | 96%+ success rate |
| **User Experience** | Transparent recovery | No error messages |
| **Service Protection** | Exponential backoff | No overwhelming |
| **Load Distribution** | Jitter prevents sync | No thundering herd |
| **Observability** | Metrics tracking | Understand patterns |
| **Cost Reduction** | Fewer manual interventions | Save ops time |

## Quick Commands

```bash
# Check retry health
curl http://localhost:8080/health/retries | jq

# Watch retry logs
kubectl logs -f -l app=api-gateway | grep -i retry

# Check Redis metrics
redis-cli GET retry:metrics:api-gateway:success
redis-cli GET retry:metrics:api-gateway:failure

# Reset metrics
curl -X POST http://localhost:8080/admin/retry/reset

# Test retry manually
curl -X POST http://localhost:8080/query \
  -H "X-Simulate-Retry: true" \
  -d '{"query": "{ orders { id } }"}'
```
