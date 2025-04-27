package utils

import (
	"os"
	"strconv"
)

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
