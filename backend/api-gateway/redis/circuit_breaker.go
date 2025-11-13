package redis

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	log "github.com/jensneuse/abstractlogger"
)

// Circuit Breaker States
type CircuitState string

const (
	StateClosed   CircuitState = "closed"    // Normal operation, requests pass through
	StateOpen     CircuitState = "open"      // Circuit is open, requests fail fast
	StateHalfOpen CircuitState = "half-open" // Testing if service recovered
)

// Circuit Breaker Redis Keys
const (
	CircuitBreakerPrefix = "circuit:"
	CBStateKey           = ":state"
	CBFailureCountKey    = ":failures"
	CBLastFailureKey     = ":last_failure"
	CBOpenedAtKey        = ":opened_at"
	CBSuccessCountKey    = ":success"
)

var (
	ErrCircuitOpen     = errors.New("circuit breaker is open")
	ErrTooManyRequests = errors.New("too many requests in half-open state")
)

// CircuitBreakerConfig holds the configuration for circuit breaker
type CircuitBreakerConfig struct {
	// MaxFailures is the number of consecutive failures before opening circuit
	MaxFailures uint32

	// Timeout is how long to wait before attempting to close an open circuit
	Timeout time.Duration

	// MaxRequests is max concurrent requests allowed in half-open state
	MaxRequests uint32

	// ResetTimeout is how long to keep failure count before resetting
	ResetTimeout time.Duration

	// FailureThreshold is the percentage of failures to trigger open state (0-100)
	FailureThreshold float64
}

// DefaultCircuitBreakerConfig returns sensible defaults
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		MaxFailures:      5,
		Timeout:          60 * time.Second,
		MaxRequests:      3,
		ResetTimeout:     30 * time.Second,
		FailureThreshold: 50.0, // 50% failure rate
	}
}

// CircuitBreaker implements the circuit breaker pattern with Redis backing
type CircuitBreaker struct {
	name   string
	config CircuitBreakerConfig
	client *redis.Client
	logger log.Logger

	// In-memory cache to reduce Redis calls
	mu             sync.RWMutex
	cachedState    CircuitState
	lastStateCheck time.Time
	stateCheckTTL  time.Duration
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(name string, config CircuitBreakerConfig, client *redis.Client, logger log.Logger) *CircuitBreaker {
	return &CircuitBreaker{
		name:          name,
		config:        config,
		client:        client,
		logger:        logger,
		cachedState:   StateClosed,
		stateCheckTTL: 1 * time.Second, // Cache state for 1 second
	}
}

// Execute runs the given function if circuit allows
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	state, err := cb.GetState(ctx)
	if err != nil {
		cb.logger.Error("Failed to get circuit state", log.Error(err))
		// Fail open - allow request if Redis is down
		return fn()
	}

	switch state {
	case StateOpen:
		// Check if timeout has passed to transition to half-open
		if cb.shouldAttemptReset(ctx) {
			if err := cb.SetState(ctx, StateHalfOpen); err != nil {
				cb.logger.Error("Failed to transition to half-open", log.Error(err))
			}
			// Continue to half-open case
			return cb.executeHalfOpen(ctx, fn)
		}
		return ErrCircuitOpen

	case StateHalfOpen:
		return cb.executeHalfOpen(ctx, fn)

	case StateClosed:
		return cb.executeClosed(ctx, fn)

	default:
		// Unknown state, default to closed
		return cb.executeClosed(ctx, fn)
	}
}

// executeClosed handles execution when circuit is closed
func (cb *CircuitBreaker) executeClosed(ctx context.Context, fn func() error) error {
	err := fn()

	if err != nil {
		cb.recordFailure(ctx)

		// Check if we should open the circuit
		failures, _ := cb.GetFailureCount(ctx)
		if failures >= cb.config.MaxFailures {
			cb.logger.Warn(fmt.Sprintf("Circuit breaker %s opening after %d failures", cb.name, failures))
			if setErr := cb.SetState(ctx, StateOpen); setErr != nil {
				cb.logger.Error("Failed to open circuit", log.Error(setErr))
			}
			cb.setOpenedAt(ctx, time.Now())
		}
		return err
	}

	// Success - reset failure count
	cb.resetFailures(ctx)
	return nil
}

// executeHalfOpen handles execution when circuit is half-open
func (cb *CircuitBreaker) executeHalfOpen(ctx context.Context, fn func() error) error {
	// Limit concurrent requests in half-open state
	successCount, _ := cb.GetSuccessCount(ctx)
	if successCount >= cb.config.MaxRequests {
		return ErrTooManyRequests
	}

	err := fn()

	if err != nil {
		// Failure in half-open state - reopen circuit
		cb.logger.Warn(fmt.Sprintf("Circuit breaker %s reopening after failure in half-open state", cb.name))
		cb.recordFailure(ctx)
		cb.SetState(ctx, StateOpen)
		cb.setOpenedAt(ctx, time.Now())
		return err
	}

	// Success - increment success count
	cb.incrementSuccess(ctx)

	// Check if we have enough successful requests to close circuit
	successCount, _ = cb.GetSuccessCount(ctx)
	if successCount >= cb.config.MaxRequests {
		cb.logger.Info(fmt.Sprintf("Circuit breaker %s closing after %d successful requests", cb.name, successCount))
		cb.SetState(ctx, StateClosed)
		cb.resetFailures(ctx)
		cb.resetSuccess(ctx)
	}

	return nil
}

// GetState returns the current state of the circuit breaker
func (cb *CircuitBreaker) GetState(ctx context.Context) (CircuitState, error) {
	// Check in-memory cache first
	cb.mu.RLock()
	if time.Since(cb.lastStateCheck) < cb.stateCheckTTL {
		state := cb.cachedState
		cb.mu.RUnlock()
		return state, nil
	}
	cb.mu.RUnlock()

	// Fetch from Redis
	key := cb.stateKey()
	val, err := cb.client.Get(ctx, key).Result()
	if err == redis.Nil {
		// No state set, default to closed
		return StateClosed, nil
	}
	if err != nil {
		return "", err
	}

	state := CircuitState(val)

	// Update cache
	cb.mu.Lock()
	cb.cachedState = state
	cb.lastStateCheck = time.Now()
	cb.mu.Unlock()

	return state, nil
}

// SetState updates the circuit breaker state
func (cb *CircuitBreaker) SetState(ctx context.Context, state CircuitState) error {
	key := cb.stateKey()
	err := cb.client.Set(ctx, key, string(state), cb.config.Timeout*2).Err()
	if err != nil {
		return err
	}

	// Update cache
	cb.mu.Lock()
	cb.cachedState = state
	cb.lastStateCheck = time.Now()
	cb.mu.Unlock()

	return nil
}

// GetFailureCount returns the current failure count
func (cb *CircuitBreaker) GetFailureCount(ctx context.Context) (uint32, error) {
	key := cb.failureCountKey()
	val, err := cb.client.Get(ctx, key).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return uint32(val), nil
}

// GetSuccessCount returns the current success count in half-open state
func (cb *CircuitBreaker) GetSuccessCount(ctx context.Context) (uint32, error) {
	key := cb.successCountKey()
	val, err := cb.client.Get(ctx, key).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return uint32(val), nil
}

// recordFailure increments the failure counter
func (cb *CircuitBreaker) recordFailure(ctx context.Context) {
	key := cb.failureCountKey()
	pipe := cb.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, cb.config.ResetTimeout)

	// Record last failure time
	lastFailKey := cb.lastFailureKey()
	pipe.Set(ctx, lastFailKey, time.Now().Unix(), cb.config.ResetTimeout)

	if _, err := pipe.Exec(ctx); err != nil {
		cb.logger.Error("Failed to record failure", log.Error(err))
	}
}

// resetFailures clears the failure counter
func (cb *CircuitBreaker) resetFailures(ctx context.Context) {
	keys := []string{
		cb.failureCountKey(),
		cb.lastFailureKey(),
	}
	if err := cb.client.Del(ctx, keys...).Err(); err != nil {
		cb.logger.Error("Failed to reset failures", log.Error(err))
	}
}

// incrementSuccess increments success counter in half-open state
func (cb *CircuitBreaker) incrementSuccess(ctx context.Context) {
	key := cb.successCountKey()
	pipe := cb.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, cb.config.Timeout)

	if _, err := pipe.Exec(ctx); err != nil {
		cb.logger.Error("Failed to increment success", log.Error(err))
	}
}

// resetSuccess clears the success counter
func (cb *CircuitBreaker) resetSuccess(ctx context.Context) {
	key := cb.successCountKey()
	if err := cb.client.Del(ctx, key).Err(); err != nil {
		cb.logger.Error("Failed to reset success", log.Error(err))
	}
}

// shouldAttemptReset checks if enough time has passed to try half-open state
func (cb *CircuitBreaker) shouldAttemptReset(ctx context.Context) bool {
	key := cb.openedAtKey()
	val, err := cb.client.Get(ctx, key).Int64()
	if err != nil {
		return true // If we can't get the time, allow attempt
	}

	openedAt := time.Unix(val, 0)
	return time.Since(openedAt) >= cb.config.Timeout
}

// setOpenedAt records when the circuit was opened
func (cb *CircuitBreaker) setOpenedAt(ctx context.Context, t time.Time) {
	key := cb.openedAtKey()
	if err := cb.client.Set(ctx, key, t.Unix(), cb.config.Timeout*2).Err(); err != nil {
		cb.logger.Error("Failed to set opened_at", log.Error(err))
	}
}

// GetMetrics returns current circuit breaker metrics
func (cb *CircuitBreaker) GetMetrics(ctx context.Context) (map[string]interface{}, error) {
	state, _ := cb.GetState(ctx)
	failures, _ := cb.GetFailureCount(ctx)
	success, _ := cb.GetSuccessCount(ctx)

	metrics := map[string]interface{}{
		"name":          cb.name,
		"state":         string(state),
		"failure_count": failures,
		"success_count": success,
		"max_failures":  cb.config.MaxFailures,
		"timeout_sec":   cb.config.Timeout.Seconds(),
	}

	// Add opened_at if circuit is open
	if state == StateOpen || state == StateHalfOpen {
		key := cb.openedAtKey()
		if val, err := cb.client.Get(ctx, key).Int64(); err == nil {
			metrics["opened_at"] = time.Unix(val, 0).Format(time.RFC3339)
		}
	}

	return metrics, nil
}

// Reset manually resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset(ctx context.Context) error {
	cb.resetFailures(ctx)
	cb.resetSuccess(ctx)

	// Delete opened_at
	if err := cb.client.Del(ctx, cb.openedAtKey()).Err(); err != nil {
		cb.logger.Error("Failed to delete opened_at", log.Error(err))
	}

	return cb.SetState(ctx, StateClosed)
}

// Key generators
func (cb *CircuitBreaker) stateKey() string {
	return CircuitBreakerPrefix + cb.name + CBStateKey
}

func (cb *CircuitBreaker) failureCountKey() string {
	return CircuitBreakerPrefix + cb.name + CBFailureCountKey
}

func (cb *CircuitBreaker) lastFailureKey() string {
	return CircuitBreakerPrefix + cb.name + CBLastFailureKey
}

func (cb *CircuitBreaker) openedAtKey() string {
	return CircuitBreakerPrefix + cb.name + CBOpenedAtKey
}

func (cb *CircuitBreaker) successCountKey() string {
	return CircuitBreakerPrefix + cb.name + CBSuccessCountKey
}
