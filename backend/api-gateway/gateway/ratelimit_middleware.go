package main

import (
	"api-gateway/redis"
	"fmt"
	"net/http"
	"time"

	log "github.com/jensneuse/abstractlogger"
)

// RateLimitMiddleware implements rate limiting using Redis
func RateLimitMiddleware(next http.Handler, rateLimiter *redis.RateLimiter, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract identifier (IP address or user ID)
		identifier := getClientIdentifier(r)

		// Check rate limit: 100 requests per minute
		allowed, remaining, resetTime, err := rateLimiter.CheckRateLimit(
			r.Context(),
			identifier,
			100,           // max requests
			1*time.Minute, // window
		)

		if err != nil {
			logger.Error("Rate limit check failed", log.Error(err))
			// On error, allow the request (fail open)
			next.ServeHTTP(w, r)
			return
		}

		// Add rate limit headers
		w.Header().Set("X-RateLimit-Limit", "100")
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		w.Header().Set("X-RateLimit-Reset", resetTime.Format(time.RFC3339))

		if !allowed {
			logger.Warn("Rate limit exceeded",
				log.String("identifier", identifier),
				log.String("endpoint", r.URL.Path),
			)

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(time.Until(resetTime).Seconds())))
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{
				"errors": [{
					"message": "Rate limit exceeded. Please try again later.",
					"extensions": {
						"code": "RATE_LIMIT_EXCEEDED",
						"limit": 100,
						"remaining": 0,
						"reset": "` + resetTime.Format(time.RFC3339) + `"
					}
				}]
			}`))
			return
		}

		logger.Debug("Rate limit check passed",
			log.String("identifier", identifier),
			log.Int("remaining", remaining),
		)

		next.ServeHTTP(w, r)
	})
}

// getClientIdentifier extracts a unique identifier for rate limiting
func getClientIdentifier(r *http.Request) string {
	// Try to get user ID from JWT claims (if available)
	// For now, use IP address as identifier

	// Check for X-Forwarded-For header (if behind proxy)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}

	// Check for X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}
