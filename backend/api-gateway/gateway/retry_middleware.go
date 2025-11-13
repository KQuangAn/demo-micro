package main

import (
	"api-gateway/redis"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	log "github.com/jensneuse/abstractlogger"
)

// RetryMiddleware wraps HTTP handlers with retry logic
func RetryMiddleware(next http.Handler, retry *redis.Retry, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Read request body (we need to replay it on retry)
		var bodyBytes []byte
		var err error
		if r.Body != nil {
			bodyBytes, err = io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "Failed to read request body", http.StatusBadRequest)
				return
			}
			r.Body.Close()
		}

		// Execute request with retry logic
		var finalRecorder *retryResponseRecorder

		err = retry.Execute(ctx, func(attempt int) error {
			// Restore request body for each attempt
			if len(bodyBytes) > 0 {
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}

			// Create response recorder to capture the response
			recorder := &retryResponseRecorder{
				statusCode: http.StatusOK,
				headers:    make(http.Header),
				body:       new(bytes.Buffer),
			}

			// Add retry attempt header
			r.Header.Set("X-Retry-Attempt", fmt.Sprintf("%d", attempt))

			// Call the next handler
			next.ServeHTTP(recorder, r)

			// Store the recorder for final response
			finalRecorder = recorder

			// Check if we should retry based on status code
			if recorder.statusCode >= 500 && recorder.statusCode < 600 {
				return fmt.Errorf("server error: %d", recorder.statusCode)
			}

			// Check specific retryable status codes
			if isRetryableStatusCode(recorder.statusCode) {
				return fmt.Errorf("retryable error: %d", recorder.statusCode)
			}

			return nil
		})

		// Write the final response
		if finalRecorder != nil {
			// Copy headers
			for key, values := range finalRecorder.headers {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}

			// Add retry result header
			if err != nil {
				w.Header().Set("X-Retry-Result", "failed")
			} else {
				w.Header().Set("X-Retry-Result", "success")
			}

			// Write status and body
			w.WriteHeader(finalRecorder.statusCode)
			w.Write(finalRecorder.body.Bytes())
		} else {
			// Fallback if no recorder (shouldn't happen)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}

		if err != nil && err != redis.ErrMaxRetriesExceeded {
			logger.Error("Retry middleware error", log.Error(err))
		}
	})
}

// retryResponseRecorder captures HTTP response for potential retry
type retryResponseRecorder struct {
	statusCode int
	headers    http.Header
	body       *bytes.Buffer
	written    bool
}

func (r *retryResponseRecorder) Header() http.Header {
	return r.headers
}

func (r *retryResponseRecorder) Write(data []byte) (int, error) {
	if !r.written {
		r.written = true
	}
	return r.body.Write(data)
}

func (r *retryResponseRecorder) WriteHeader(statusCode int) {
	if !r.written {
		r.statusCode = statusCode
		r.written = true
	}
}

// isRetryableStatusCode checks if a status code should trigger retry
func isRetryableStatusCode(statusCode int) bool {
	retryable := []int{
		http.StatusBadGateway,         // 502
		http.StatusServiceUnavailable, // 503
		http.StatusGatewayTimeout,     // 504
		http.StatusRequestTimeout,     // 408
		429,                           // Too Many Requests (rate limit)
	}

	for _, code := range retryable {
		if statusCode == code {
			return true
		}
	}

	return false
}

// RetryHealthHandler provides retry metrics endpoint
func RetryHealthHandler(retryManager *redis.RetryManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		metrics := retryManager.GetAllMetrics(ctx)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		// Simple JSON marshaling
		w.Write([]byte(`{"retry_metrics":`))
		writeJSON(w, metrics)
		w.Write([]byte(`,"timestamp":"`))
		w.Write([]byte(time.Now().Format(time.RFC3339)))
		w.Write([]byte(`"}`))
	}
}

// Helper function to write JSON (simple version)
func writeJSON(w http.ResponseWriter, data interface{}) {
	switch v := data.(type) {
	case map[string]interface{}:
		w.Write([]byte("{"))
		first := true
		for key, val := range v {
			if !first {
				w.Write([]byte(","))
			}
			first = false
			w.Write([]byte(fmt.Sprintf(`"%s":`, key)))
			writeJSON(w, val)
		}
		w.Write([]byte("}"))
	case string:
		w.Write([]byte(fmt.Sprintf(`"%s"`, v)))
	case int, int64, float64:
		w.Write([]byte(fmt.Sprintf(`%v`, v)))
	default:
		w.Write([]byte(fmt.Sprintf(`"%v"`, v)))
	}
}

// CombinedRetryCircuitBreakerMiddleware combines retry and circuit breaker patterns
// Order: Retry → Circuit Breaker → Handler
// This means retries happen before circuit breaker evaluation
func CombinedRetryCircuitBreakerMiddleware(
	next http.Handler,
	retry *redis.Retry,
	breaker *redis.CircuitBreaker,
	logger log.Logger,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Read request body (we need to replay it on retry)
		var bodyBytes []byte
		var err error
		if r.Body != nil {
			bodyBytes, err = io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "Failed to read request body", http.StatusBadRequest)
				return
			}
			r.Body.Close()
		}

		var finalRecorder *retryResponseRecorder

		// Retry wrapper around circuit breaker
		err = retry.ExecuteWithCondition(ctx, func(attempt int) error {
			// Restore request body for each attempt
			if len(bodyBytes) > 0 {
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}

			// Circuit breaker execution
			return breaker.Execute(ctx, func() error {
				// Restore body again for circuit breaker retry
				if len(bodyBytes) > 0 {
					r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				}

				recorder := &retryResponseRecorder{
					statusCode: http.StatusOK,
					headers:    make(http.Header),
					body:       new(bytes.Buffer),
				}

				// Add attempt headers
				r.Header.Set("X-Retry-Attempt", fmt.Sprintf("%d", attempt))

				// Call the actual handler
				next.ServeHTTP(recorder, r)

				finalRecorder = recorder

				// Treat 5xx as failure for both retry and circuit breaker
				if recorder.statusCode >= 500 {
					return fmt.Errorf("upstream service error: %d", recorder.statusCode)
				}

				return nil
			})
		}, func(err error, attempt int) bool {
			// Custom retry condition that respects circuit breaker
			if err == redis.ErrCircuitOpen {
				// Don't retry if circuit is open
				logger.Warn("Circuit breaker open, stopping retry attempts")
				return false
			}
			return true // Retry other errors
		})

		// Write final response
		if finalRecorder != nil {
			for key, values := range finalRecorder.headers {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}

			if err != nil {
				w.Header().Set("X-Retry-Result", "failed")
				if err == redis.ErrCircuitOpen {
					w.Header().Set("X-Circuit-Breaker-State", "open")
				}
			} else {
				w.Header().Set("X-Retry-Result", "success")
			}

			w.WriteHeader(finalRecorder.statusCode)
			w.Write(finalRecorder.body.Bytes())
		} else {
			// Handle circuit breaker open error
			if err == redis.ErrCircuitOpen {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Circuit-Breaker-State", "open")
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"errors":[{"message":"Service temporarily unavailable - circuit breaker is open"}]}`))
				return
			}
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
	})
}
