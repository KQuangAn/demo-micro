package redis

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	log "github.com/jensneuse/abstractlogger"
)

// CacheService handles all caching operations
type CacheService struct {
	client *redis.Client
	logger log.Logger
}

// NewCacheService creates a new cache service
func NewCacheService(client *redis.Client, logger log.Logger) *CacheService {
	return &CacheService{
		client: client,
		logger: logger,
	}
}

// GraphQL Query Cache Keys
const (
	QueryCachePrefix     = "gql:query:"
	SchemaCache          = "gql:schema:"
	SubgraphStatusPrefix = "gql:subgraph:status:"
	RateLimitPrefix      = "ratelimit:"
	SessionPrefix        = "session:"
)

// CacheOptions configuration for caching behavior
type CacheOptions struct {
	TTL          time.Duration
	DisableCache bool
	CacheKey     string
	RefreshOnHit bool // Extend TTL when cache is hit
}

// DefaultCacheOptions returns sensible defaults
func DefaultCacheOptions() CacheOptions {
	return CacheOptions{
		TTL:          5 * time.Minute,
		DisableCache: false,
		RefreshOnHit: true,
	}
}

// GenerateQueryCacheKey creates a consistent cache key from query and variables
func (cs *CacheService) GenerateQueryCacheKey(query string, variables map[string]interface{}) string {
	// Include both query and variables in the key
	data := fmt.Sprintf("%s:%v", query, variables)
	hash := sha256.Sum256([]byte(data))
	return QueryCachePrefix + hex.EncodeToString(hash[:])
}

// GetQueryCache retrieves a cached GraphQL query result
func (cs *CacheService) GetQueryCache(ctx context.Context, cacheKey string) ([]byte, bool, error) {
	result, err := cs.client.Get(ctx, cacheKey).Result()
	if err == redis.Nil {
		cs.logger.Debug("Cache miss", log.String("key", cacheKey))
		return nil, false, nil
	}
	if err != nil {
		cs.logger.Error("Failed to get from cache", log.Error(err), log.String("key", cacheKey))
		return nil, false, err
	}

	cs.logger.Debug("Cache hit", log.String("key", cacheKey))
	return []byte(result), true, nil
}

// SetQueryCache stores a GraphQL query result in cache
func (cs *CacheService) SetQueryCache(ctx context.Context, cacheKey string, data []byte, ttl time.Duration) error {
	err := cs.client.Set(ctx, cacheKey, data, ttl).Err()
	if err != nil {
		cs.logger.Error("Failed to set cache", log.Error(err), log.String("key", cacheKey))
		return err
	}

	cs.logger.Debug("Cache set", log.String("key", cacheKey), log.Any("ttl", ttl))
	return nil
}

// InvalidateQueryPattern invalidates all queries matching a pattern
func (cs *CacheService) InvalidateQueryPattern(ctx context.Context, pattern string) error {
	// Use SCAN to find all matching keys (better than KEYS for production)
	iter := cs.client.Scan(ctx, 0, pattern, 0).Iterator()
	var keys []string

	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return cs.client.Del(ctx, keys...).Err()
	}

	return nil
}

// CacheSchema stores the federated GraphQL schema
func (cs *CacheService) CacheSchema(ctx context.Context, serviceName string, schema string, ttl time.Duration) error {
	key := SchemaCache + serviceName
	return cs.client.Set(ctx, key, schema, ttl).Err()
}

// GetCachedSchema retrieves a cached schema
func (cs *CacheService) GetCachedSchema(ctx context.Context, serviceName string) (string, bool, error) {
	key := SchemaCache + serviceName
	result, err := cs.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return result, true, nil
}

// SetSubgraphStatus stores the health status of a subgraph
func (cs *CacheService) SetSubgraphStatus(ctx context.Context, serviceName string, isHealthy bool) error {
	key := SubgraphStatusPrefix + serviceName
	status := map[string]interface{}{
		"healthy":     isHealthy,
		"lastCheck":   time.Now().Unix(),
		"serviceName": serviceName,
	}

	data, err := json.Marshal(status)
	if err != nil {
		return err
	}

	// Keep status for 1 minute
	return cs.client.Set(ctx, key, data, 1*time.Minute).Err()
}

// GetSubgraphStatus retrieves the health status of a subgraph
func (cs *CacheService) GetSubgraphStatus(ctx context.Context, serviceName string) (bool, error) {
	key := SubgraphStatusPrefix + serviceName
	result, err := cs.client.Get(ctx, key).Result()
	if err == redis.Nil {
		// Default to healthy if no status cached
		return true, nil
	}
	if err != nil {
		return false, err
	}

	var status map[string]interface{}
	if err := json.Unmarshal([]byte(result), &status); err != nil {
		return false, err
	}

	healthy, ok := status["healthy"].(bool)
	if !ok {
		return false, fmt.Errorf("invalid status format")
	}

	return healthy, nil
}

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
	client *redis.Client
	logger log.Logger
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(client *redis.Client, logger log.Logger) *RateLimiter {
	return &RateLimiter{
		client: client,
		logger: logger,
	}
}

// CheckRateLimit checks if a request should be allowed based on rate limiting
// Returns: allowed (bool), remaining (int), resetTime (time.Time), error
func (rl *RateLimiter) CheckRateLimit(ctx context.Context, identifier string, maxRequests int, window time.Duration) (bool, int, time.Time, error) {
	key := RateLimitPrefix + identifier
	now := time.Now()

	// Use Redis pipeline for atomic operations
	pipe := rl.client.Pipeline()

	// Remove old entries outside the window
	windowStart := now.Add(-window).Unix()
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))

	// Count current requests
	countCmd := pipe.ZCard(ctx, key)

	// Add current request
	pipe.ZAdd(ctx, key, &redis.Z{
		Score:  float64(now.Unix()),
		Member: fmt.Sprintf("%d", now.UnixNano()),
	})

	// Set expiry on key
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, 0, time.Time{}, err
	}

	count := int(countCmd.Val())
	remaining := maxRequests - count - 1
	resetTime := now.Add(window)

	allowed := count < maxRequests

	if !allowed {
		rl.logger.Warn("Rate limit exceeded",
			log.String("identifier", identifier),
			log.Int("count", count),
			log.Int("max", maxRequests),
		)
	}

	return allowed, remaining, resetTime, nil
}

// SessionManager handles user sessions
type SessionManager struct {
	client *redis.Client
	logger log.Logger
}

// NewSessionManager creates a new session manager
func NewSessionManager(client *redis.Client, logger log.Logger) *SessionManager {
	return &SessionManager{
		client: client,
		logger: logger,
	}
}

// SessionData represents a user session
type SessionData struct {
	UserID    string                 `json:"user_id"`
	Username  string                 `json:"username"`
	CreatedAt int64                  `json:"created_at"`
	ExpiresAt int64                  `json:"expires_at"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// CreateSession stores a new session
func (sm *SessionManager) CreateSession(ctx context.Context, sessionID string, data SessionData, ttl time.Duration) error {
	key := SessionPrefix + sessionID

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return sm.client.Set(ctx, key, jsonData, ttl).Err()
}

// GetSession retrieves a session
func (sm *SessionManager) GetSession(ctx context.Context, sessionID string) (*SessionData, error) {
	key := SessionPrefix + sessionID

	result, err := sm.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("session not found")
	}
	if err != nil {
		return nil, err
	}

	var data SessionData
	if err := json.Unmarshal([]byte(result), &data); err != nil {
		return nil, err
	}

	return &data, nil
}

// DeleteSession removes a session (logout)
func (sm *SessionManager) DeleteSession(ctx context.Context, sessionID string) error {
	key := SessionPrefix + sessionID
	return sm.client.Del(ctx, key).Err()
}

// ExtendSession extends the TTL of a session
func (sm *SessionManager) ExtendSession(ctx context.Context, sessionID string, ttl time.Duration) error {
	key := SessionPrefix + sessionID
	return sm.client.Expire(ctx, key, ttl).Err()
}

// GetAllUserSessions retrieves all sessions for a user
func (sm *SessionManager) GetAllUserSessions(ctx context.Context, userID string) ([]string, error) {
	pattern := SessionPrefix + "*"
	iter := sm.client.Scan(ctx, 0, pattern, 0).Iterator()
	var sessionIDs []string

	for iter.Next(ctx) {
		key := iter.Val()
		result, err := sm.client.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		var data SessionData
		if err := json.Unmarshal([]byte(result), &data); err != nil {
			continue
		}

		if data.UserID == userID {
			sessionIDs = append(sessionIDs, key[len(SessionPrefix):])
		}
	}

	return sessionIDs, iter.Err()
}
