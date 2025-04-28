package redis

import (
	"context"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	log "github.com/jensneuse/abstractlogger"
)

var (
	client *redis.Client
	logger = log.Noop{}
)

func Init() error {
	addr := os.Getenv("REDIS_ADDR")
	password := os.Getenv("REDIS_PASSWORD")

	if addr == "" {
		logger.Error("REDIS_ADDR is not set")
		return ErrMissingRedisConfig
	}

	client = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Error("Failed to connect to Redis", log.Error(err))
		return err
	}

	logger.Info("Connected to Redis successfully", log.String("addr", addr))
	return nil
}

func Client() *redis.Client {
	if client == nil {
		logger.Fatal("Redis client is not initialized")
	}
	return client
}

var ErrMissingRedisConfig = redisError("missing Redis configuration")

type redisError string

func (e redisError) Error() string {
	return string(e)
}
