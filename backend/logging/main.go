package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	logFilePath = "logs/server.log"
)

func setupLogging() {
	// Create logs directory if it doesn't exist
	os.MkdirAll("logs", os.ModePerm)

	// Open the log file
	logFile, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening log file: %v", err)
	}
	log.SetOutput(logFile)
}

func logRequest(w http.ResponseWriter, r *http.Request) {
	log.Printf("Received request: %s %s\n", r.Method, r.URL.Path)
	fmt.Fprintf(w, "Hello, you've requested: %s\n", r.URL.Path)
}

func main() {
	setupLogging()

	// Set up a periodic logging function
	go func() {
		for {
			log.Println("Server is running...")
			time.Sleep(30 * time.Second) // Log every 10 seconds
		}
	}()

	http.HandleFunc("/", logRequest)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
