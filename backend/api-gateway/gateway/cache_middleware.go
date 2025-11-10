package main

import (
	"api-gateway/redis"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	log "github.com/jensneuse/abstractlogger"
)

// GraphQLRequest represents a GraphQL query request
type GraphQLRequest struct {
	Query         string                 `json:"query"`
	Variables     map[string]interface{} `json:"variables"`
	OperationName string                 `json:"operationName"`
}

// GraphQLCacheMiddleware caches GraphQL query responses
func GraphQLCacheMiddleware(next http.Handler, cacheService *redis.CacheService, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only cache POST requests to /query endpoint
		if r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}

		// Read request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			logger.Error("Failed to read request body", log.Error(err))
			next.ServeHTTP(w, r)
			return
		}
		defer r.Body.Close()

		// Parse GraphQL request
		var gqlReq GraphQLRequest
		if err := json.Unmarshal(body, &gqlReq); err != nil {
			logger.Error("Failed to parse GraphQL request", log.Error(err))
			r.Body = io.NopCloser(bytes.NewBuffer(body))
			next.ServeHTTP(w, r)
			return
		}

		// Skip caching for mutations
		if isMutation(gqlReq.Query) {
			logger.Debug("Skipping cache for mutation")
			r.Body = io.NopCloser(bytes.NewBuffer(body))
			next.ServeHTTP(w, r)
			return
		}

		// Generate cache key
		cacheKey := cacheService.GenerateQueryCacheKey(gqlReq.Query, gqlReq.Variables)

		// Try to get from cache
		cached, hit, err := cacheService.GetQueryCache(r.Context(), cacheKey)
		if hit && err == nil {
			logger.Info("Cache hit", log.String("key", cacheKey))
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Header().Set("X-Cache-Key", cacheKey[:16]+"...") // Show first 16 chars
			w.WriteHeader(http.StatusOK)
			w.Write(cached)
			return
		}

		if err != nil {
			logger.Error("Cache lookup failed", log.Error(err))
		}

		logger.Debug("Cache miss", log.String("key", cacheKey))

		// Cache miss - capture response
		rec := httptest.NewRecorder()
		r.Body = io.NopCloser(bytes.NewBuffer(body)) // Restore body
		next.ServeHTTP(rec, r)

		// Get response
		response := rec.Body.Bytes()

		// Only cache successful responses (200 OK)
		if rec.Code == http.StatusOK && len(response) > 0 {
			// Store in cache with 5 minute TTL
			if err := cacheService.SetQueryCache(r.Context(), cacheKey, response, 5*time.Minute); err != nil {
				logger.Error("Failed to set cache", log.Error(err))
			} else {
				logger.Info("Cached response", log.String("key", cacheKey), log.Int("size", len(response)))
			}
		}

		// Send response to client
		w.Header().Set("X-Cache", "MISS")
		w.Header().Set("X-Cache-Key", cacheKey[:16]+"...")
		for k, v := range rec.Header() {
			w.Header()[k] = v
		}
		w.WriteHeader(rec.Code)
		w.Write(response)
	})
}

// isMutation checks if the query is a mutation
func isMutation(query string) bool {
	// Simple check - look for mutation keyword
	trimmed := strings.TrimSpace(strings.ToLower(query))
	return strings.HasPrefix(trimmed, "mutation")
}
