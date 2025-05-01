package utils

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

func LoadEnvFile(ctx context.Context) {
	envPaths := []string{"./.env", "../../.env"}
	var rootEnvPath string
	var err error

	for _, path := range envPaths {
		rootEnvPath, err = filepath.Abs(path)
		if err != nil {
			log.Printf("Error getting absolute path for %s: %v", path, err)
			continue
		}

		err = godotenv.Load(rootEnvPath)
		if err == nil {
			log.Printf("Successfully loaded .env file from: %s", rootEnvPath)
			break
		} else {
			log.Printf("Error loading .env file from %s: %v", rootEnvPath, err)
		}
	}

	if err != nil {
		log.Fatalf("Failed to load .env file from any of the specified paths")
	}

	ValidateEnvVars()
}

func ValidateEnvVars() {
	requiredVars := []string{
		"AWS_ACCESS_KEY_ID",
		"AWS_SECRET_ACCESS_KEY",
		"AWS_REGION",
		"LOCALSTACK_HOST",
		"MAX_NUMBER_OF_MESSAGE",
		"WAIT_TIME_SECONDS",
		"EVENT_BRIDGE_EVENT_SOURCE",
		"EVENT_BRIDGE_BUS_NAME",
		"ORDERS_QUEUE_URL",
		"DATABASE_URL",
		"DATABASE_USERNAME",
		"DATABASE_PASSWORD",
		"DATABASE_NAME",
		"ORDER_TABLE_NAME",
		"ORDER_DETAIL_TABLE_NAME",
	}

	for _, varName := range requiredVars {
		if value := os.Getenv(varName); value == "" {
			log.Fatalf("Missing required environment variable: %s", varName)
		} else {
			log.Printf("Environment variable %s is set to: %s", varName, value)
		}
	}
}

func GetEnv[T any](key string, defaultVal T) T {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}

	switch any(defaultVal).(type) {
	case int:
		if val, err := strconv.Atoi(valStr); err == nil {
			return any(val).(T)
		}
	case int32:
		if val, err := strconv.Atoi(valStr); err == nil {
			return any(int32(val)).(T)
		}
	case string:
		return any(valStr).(T)
	}

	return defaultVal
}
