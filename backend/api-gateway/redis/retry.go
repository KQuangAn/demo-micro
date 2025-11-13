package redis

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/go-redis/redis/v8"
	log "github.com/jensneuse/abstractlogger"
)

// Retry configuration constants
const (
	RetryMetricsPrefix = "retry:metrics:"
	RetryAttemptsKey   = ":attempts"
	RetrySuccessKey    = ":success"
	RetryFailureKey    = ":failure"
)

var (
	ErrMaxRetriesExceeded = errors.New("max retries exceeded")
	ErrNonRetryableError  = errors.New("non-retryable error")
)

// RetryConfig holds the configuration for retry logic
type RetryConfig struct {
	// MaxAttempts is the maximum number of retry attempts (including initial try)
	MaxAttempts int

	// InitialDelay is the delay before the first retry
	InitialDelay time.Duration

	// MaxDelay is the maximum delay between retries
	MaxDelay time.Duration

	// Multiplier for exponential backoff (typically 2.0)
	Multiplier float64

	// Jitter adds randomness to prevent thundering herd (0.0 to 1.0)
	Jitter float64

	// RetryableStatusCodes defines which HTTP status codes should trigger retry
	RetryableStatusCodes []int

	// RetryOnTimeout whether to retry on context timeout
	RetryOnTimeout bool

	// RetryOn5xx whether to retry on 5xx server errors
	RetryOn5xx bool
}

// DefaultRetryConfig returns sensible defaults for retry logic
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:          3,
		InitialDelay:         100 * time.Millisecond,
		MaxDelay:             5 * time.Second,
		Multiplier:           2.0,
		Jitter:               0.1,
		RetryableStatusCodes: []int{502, 503, 504}, // Bad Gateway, Service Unavailable, Gateway Timeout
		RetryOnTimeout:       true,
		RetryOn5xx:           true,
	}
}

// RetryableFunc is a function that can be retried
type RetryableFunc func(attempt int) error

// ShouldRetryFunc determines if an error is retryable
type ShouldRetryFunc func(err error, attempt int) bool

// Retry implements the retry pattern with exponential backoff
type Retry struct {
	name   string
	config RetryConfig
	client *redis.Client
	logger log.Logger
}

// NewRetry creates a new retry handler
func NewRetry(name string, config RetryConfig, client *redis.Client, logger log.Logger) *Retry {
	return &Retry{
		name:   name,
		config: config,
		client: client,
		logger: logger,
	}
}

// Execute runs the given function with retry logic
func (r *Retry) Execute(ctx context.Context, fn RetryableFunc) error {
	return r.ExecuteWithCondition(ctx, fn, r.defaultShouldRetry)
}

// ExecuteWithCondition runs the function with custom retry condition
func (r *Retry) ExecuteWithCondition(ctx context.Context, fn RetryableFunc, shouldRetry ShouldRetryFunc) error {
	var lastErr error

	for attempt := 1; attempt <= r.config.MaxAttempts; attempt++ {
		// Record attempt
		r.recordAttempt(ctx, attempt)

		// Execute the function
		err := fn(attempt)

		if err == nil {
			// Success!
			r.recordSuccess(ctx)
			if attempt > 1 {
				r.logger.Info(fmt.Sprintf("Retry %s succeeded on attempt %d/%d", r.name, attempt, r.config.MaxAttempts))
			}
			return nil
		}

		lastErr = err

		// Check if we should retry
		if !shouldRetry(err, attempt) {
			r.recordFailure(ctx)
			r.logger.Warn(fmt.Sprintf("Retry %s non-retryable error on attempt %d: %v", r.name, attempt, err))
			return err
		}

		// Check if we've exhausted retries
		if attempt >= r.config.MaxAttempts {
			r.recordFailure(ctx)
			r.logger.Error(fmt.Sprintf("Retry %s max attempts (%d) exceeded", r.name, r.config.MaxAttempts), log.Error(err))
			return fmt.Errorf("%w: %v", ErrMaxRetriesExceeded, err)
		}

		// Calculate backoff delay
		delay := r.calculateBackoff(attempt)

		r.logger.Warn(fmt.Sprintf("Retry %s attempt %d/%d failed, retrying in %v: %v",
			r.name, attempt, r.config.MaxAttempts, delay, err))

		// Wait before retry, respecting context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next attempt
		}
	}

	return fmt.Errorf("%w: %v", ErrMaxRetriesExceeded, lastErr)
}

// calculateBackoff calculates the delay before next retry with exponential backoff and jitter
func (r *Retry) calculateBackoff(attempt int) time.Duration {
	// Exponential backoff: delay = initialDelay * (multiplier ^ (attempt - 1))
	exponentialDelay := float64(r.config.InitialDelay) * math.Pow(r.config.Multiplier, float64(attempt-1))

	// Cap at max delay
	delay := time.Duration(math.Min(exponentialDelay, float64(r.config.MaxDelay)))

	// Add jitter to prevent thundering herd
	if r.config.Jitter > 0 {
		jitterAmount := float64(delay) * r.config.Jitter
		jitter := (rand.Float64()*2 - 1) * jitterAmount // Random value between -jitter and +jitter
		delay = time.Duration(float64(delay) + jitter)

		// Ensure delay is positive
		if delay < 0 {
			delay = r.config.InitialDelay
		}
	}

	return delay
}

// defaultShouldRetry determines if an error should trigger a retry
func (r *Retry) defaultShouldRetry(err error, attempt int) bool {
	if err == nil {
		return false
	}

	// Don't retry if circuit breaker is open
	if errors.Is(err, ErrCircuitOpen) {
		return false
	}

	// Don't retry non-retryable errors
	if errors.Is(err, ErrNonRetryableError) {
		return false
	}

	// Check for timeout errors
	if r.config.RetryOnTimeout {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return true
		}
	}

	// Check for Redis errors
	if errors.Is(err, redis.Nil) {
		return false // Cache miss is not retryable
	}

	// By default, retry on temporary/transient errors
	return true
}

// recordAttempt records a retry attempt
func (r *Retry) recordAttempt(ctx context.Context, attempt int) {
	key := r.metricsKey(RetryAttemptsKey)
	pipe := r.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 24*time.Hour)

	if _, err := pipe.Exec(ctx); err != nil {
		r.logger.Error("Failed to record retry attempt", log.Error(err))
	}
}

// recordSuccess records a successful retry
func (r *Retry) recordSuccess(ctx context.Context) {
	key := r.metricsKey(RetrySuccessKey)
	pipe := r.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 24*time.Hour)

	if _, err := pipe.Exec(ctx); err != nil {
		r.logger.Error("Failed to record retry success", log.Error(err))
	}
}

// recordFailure records a failed retry (after all attempts)
func (r *Retry) recordFailure(ctx context.Context) {
	key := r.metricsKey(RetryFailureKey)
	pipe := r.client.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 24*time.Hour)

	if _, err := pipe.Exec(ctx); err != nil {
		r.logger.Error("Failed to record retry failure", log.Error(err))
	}
}

// GetMetrics returns current retry metrics
func (r *Retry) GetMetrics(ctx context.Context) (map[string]interface{}, error) {
	attemptsKey := r.metricsKey(RetryAttemptsKey)
	successKey := r.metricsKey(RetrySuccessKey)
	failureKey := r.metricsKey(RetryFailureKey)

	pipe := r.client.Pipeline()
	attemptsCmd := pipe.Get(ctx, attemptsKey)
	successCmd := pipe.Get(ctx, successKey)
	failureCmd := pipe.Get(ctx, failureKey)

	_, err := pipe.Exec(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}

	attempts, _ := attemptsCmd.Int64()
	success, _ := successCmd.Int64()
	failure, _ := failureCmd.Int64()

	// Calculate success rate
	successRate := 0.0
	totalOperations := success + failure
	if totalOperations > 0 {
		successRate = float64(success) / float64(totalOperations) * 100
	}

	// Calculate average retries per operation
	avgRetries := 0.0
	if totalOperations > 0 {
		avgRetries = float64(attempts) / float64(totalOperations)
	}

	return map[string]interface{}{
		"name":               r.name,
		"total_attempts":     attempts,
		"successful_ops":     success,
		"failed_ops":         failure,
		"success_rate":       fmt.Sprintf("%.2f%%", successRate),
		"avg_retries_per_op": fmt.Sprintf("%.2f", avgRetries),
		"max_attempts":       r.config.MaxAttempts,
		"initial_delay_ms":   r.config.InitialDelay.Milliseconds(),
		"max_delay_ms":       r.config.MaxDelay.Milliseconds(),
	}, nil
}

// Reset clears retry metrics
func (r *Retry) Reset(ctx context.Context) error {
	keys := []string{
		r.metricsKey(RetryAttemptsKey),
		r.metricsKey(RetrySuccessKey),
		r.metricsKey(RetryFailureKey),
	}

	return r.client.Del(ctx, keys...).Err()
}

// metricsKey generates Redis key for metrics
func (r *Retry) metricsKey(suffix string) string {
	return RetryMetricsPrefix + r.name + suffix
}

// RetryManager manages multiple retry handlers
type RetryManager struct {
	retries map[string]*Retry
	client  *redis.Client
	logger  log.Logger
}

// NewRetryManager creates a new retry manager
func NewRetryManager(client *redis.Client, logger log.Logger) *RetryManager {
	return &RetryManager{
		retries: make(map[string]*Retry),
		client:  client,
		logger:  logger,
	}
}

// GetOrCreateRetry gets or creates a retry handler
func (rm *RetryManager) GetOrCreateRetry(name string, config RetryConfig) *Retry {
	if retry, exists := rm.retries[name]; exists {
		return retry
	}

	retry := NewRetry(name, config, rm.client, rm.logger)
	rm.retries[name] = retry
	return retry
}

// GetRetry returns a retry handler by name
func (rm *RetryManager) GetRetry(name string) (*Retry, bool) {
	retry, exists := rm.retries[name]
	return retry, exists
}

// GetAllMetrics returns metrics for all retry handlers
func (rm *RetryManager) GetAllMetrics(ctx context.Context) map[string]interface{} {
	metrics := make(map[string]interface{})

	for name, retry := range rm.retries {
		if retryMetrics, err := retry.GetMetrics(ctx); err == nil {
			metrics[name] = retryMetrics
		}
	}

	return metrics
}

// ResetAll resets all retry metrics
func (rm *RetryManager) ResetAll(ctx context.Context) error {
	for _, retry := range rm.retries {
		if err := retry.Reset(ctx); err != nil {
			return err
		}
	}
	return nil
}
