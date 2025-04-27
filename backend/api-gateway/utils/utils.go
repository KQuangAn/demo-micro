package utils

import (
	"log"
	"path/filepath"

	"github.com/joho/godotenv"
)

func LoadEnvFile() {
	envPaths := []string{"./.env", "../.env"}
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
			return
		} else {
			log.Printf("Error loading .env file from %s: %v", rootEnvPath, err)
		}
	}

	log.Printf("Failed to load .env file from any of the specified paths")
}
