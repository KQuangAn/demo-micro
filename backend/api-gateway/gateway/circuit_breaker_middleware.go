package main

import (
	"api-gateway/redis"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	goredis "github.com/go-redis/redis/v8"
	log "github.com/jensneuse/abstractlogger"
)

// CircuitBreakerMiddleware wraps HTTP handlers with circuit breaker logic
func CircuitBreakerMiddleware(next http.Handler, breaker *redis.CircuitBreaker, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		
		// Execute request through circuit breaker
		err := breaker.Execute(ctx, func() error {
			// Use a response recorder to capture the response
			recorder := &circuitBreakerResponseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}
			
			// Call the next handler
			next.ServeHTTP(recorder, r)
			
			// Treat 5xx errors as failures for circuit breaker
			if recorder.statusCode >= 500 {
				return fmt.Errorf("upstream service error: %d", recorder.statusCode)
			}
			
			return nil
		})
		
		if err != nil {
			handleCircuitBreakerError(w, r, err, breaker, logger)
			return
		}
	})
}

// circuitBreakerResponseWriter captures the status code
type circuitBreakerResponseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (w *circuitBreakerResponseWriter) WriteHeader(statusCode int) {
	if !w.written {
		w.statusCode = statusCode
		w.ResponseWriter.WriteHeader(statusCode)
		w.written = true
	}
}

func (w *circuitBreakerResponseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

// handleCircuitBreakerError handles circuit breaker specific errors
func handleCircuitBreakerError(w http.ResponseWriter, r *http.Request, err error, breaker *redis.CircuitBreaker, logger log.Logger) {
	ctx := r.Context()
	
	switch err {
	case redis.ErrCircuitOpen:
		// Circuit is open - service is unavailable
		metrics, _ := breaker.GetMetrics(ctx)
		
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Circuit-Breaker-State", "open")
		w.Header().Set("Retry-After", "60") // Suggest retry after timeout
		w.WriteHeader(http.StatusServiceUnavailable)
		
		response := map[string]interface{}{
			"errors": []map[string]interface{}{
				{
					"message": "Service temporarily unavailable - circuit breaker is open",
					"extensions": map[string]interface{}{
						"code":           "CIRCUIT_BREAKER_OPEN",
						"circuit_state":  metrics["state"],
						"failure_count":  metrics["failure_count"],
						"retry_after":    60,
					},
				},
			},
		}
		
		json.NewEncoder(w).Encode(response)
		logger.Warn(fmt.Sprintf("Circuit breaker open for request: %s", r.URL.Path))
		
	case redis.ErrTooManyRequests:
		// Half-open state, too many concurrent requests
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Circuit-Breaker-State", "half-open")
		w.Header().Set("Retry-After", "5")
		w.WriteHeader(http.StatusTooManyRequests)
		
		response := map[string]interface{}{
			"errors": []map[string]interface{}{
				{
					"message": "Too many requests - circuit breaker is in recovery mode",
					"extensions": map[string]interface{}{
						"code":        "CIRCUIT_BREAKER_HALF_OPEN",
						"retry_after": 5,
					},
				},
			},
		}
		
		json.NewEncoder(w).Encode(response)
		
	default:
		// Other errors - treat as service failure
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		
		response := map[string]interface{}{
			"errors": []map[string]interface{}{
				{
					"message": "Service error",
					"extensions": map[string]interface{}{
						"code": "SERVICE_ERROR",
					},
				},
			},
		}
		
		json.NewEncoder(w).Encode(response)
		logger.Error("Circuit breaker error", log.Error(err))
	}
}

// CircuitBreakerManager manages multiple circuit breakers for different services
type CircuitBreakerManager struct {
	breakers map[string]*redis.CircuitBreaker
	client   *goredis.Client
	logger   log.Logger
}

// NewCircuitBreakerManager creates a new circuit breaker manager
func NewCircuitBreakerManager(client *goredis.Client, logger log.Logger) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*redis.CircuitBreaker),
		client:   client,
		logger:   logger,
	}
}

// GetOrCreateBreaker gets or creates a circuit breaker for a service
func (m *CircuitBreakerManager) GetOrCreateBreaker(serviceName string, config redis.CircuitBreakerConfig) *redis.CircuitBreaker {
	if breaker, exists := m.breakers[serviceName]; exists {
		return breaker
	}
	
	breaker := redis.NewCircuitBreaker(serviceName, config, m.client, m.logger)
	m.breakers[serviceName] = breaker
	return breaker
}

// GetBreaker returns a circuit breaker by name
func (m *CircuitBreakerManager) GetBreaker(serviceName string) (*redis.CircuitBreaker, bool) {
	breaker, exists := m.breakers[serviceName]
	return breaker, exists
}

// GetAllMetrics returns metrics for all circuit breakers
func (m *CircuitBreakerManager) GetAllMetrics(ctx context.Context) map[string]interface{} {
	metrics := make(map[string]interface{})
	
	for name, breaker := range m.breakers {
		if breakerMetrics, err := breaker.GetMetrics(ctx); err == nil {
			metrics[name] = breakerMetrics
		}
	}
	
	return metrics
}

// ResetAll resets all circuit breakers
func (m *CircuitBreakerManager) ResetAll(ctx context.Context) error {
	for _, breaker := range m.breakers {
		if err := breaker.Reset(ctx); err != nil {
			return err
		}
	}
	return nil
}

// HealthCheckHandler provides circuit breaker health status
func (m *CircuitBreakerManager) HealthCheckHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		
		metrics := m.GetAllMetrics(ctx)
		
		w.Header().Set("Content-Type", "application/json")
		
		// Check if any circuit is open
		allHealthy := true
		for _, breakerMetrics := range metrics {
			if m, ok := breakerMetrics.(map[string]interface{}); ok {
				if state, ok := m["state"].(string); ok && state == "open" {
					allHealthy = false
					break
				}
			}
		}
		
		if allHealthy {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		
		response := map[string]interface{}{
			"status":          getHealthStatus(allHealthy),
			"circuit_breakers": metrics,
			"timestamp":       time.Now().Format(time.RFC3339),
		}
		
		json.NewEncoder(w).Encode(response)
	}
}

func getHealthStatus(healthy bool) string {
	if healthy {
		return "healthy"
	}
	return "degraded"
}
