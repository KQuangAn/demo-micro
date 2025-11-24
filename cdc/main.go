package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/segmentio/kafka-go"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go consumeCDCTopic(ctx)

	// Connection string for the Postgres service defined in docker-compose
	// Note: If running this from host machine, use localhost. If running inside docker, use service name.
	// Assuming running from host machine for this example.
	connStr := "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Wait for DB to be ready
	for {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Println("Waiting for database...", err)
		time.Sleep(2 * time.Second)
	}
	fmt.Println("Connected to database")

	// Create table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		name TEXT,
		email TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		log.Fatal("Failed to create table:", err)
	}
	fmt.Println("Table 'users' created/verified")

	// Insert data periodically
	i := 0
	for {
		i++
		name := fmt.Sprintf("User %d", i)
		email := fmt.Sprintf("user%d@example.com", i)
		_, err = db.Exec("INSERT INTO users (name, email) VALUES ($1, $2)", name, email)
		if err != nil {
			log.Println("Error inserting user:", err)
		} else {
			fmt.Printf("Inserted %s\n", name)
		}
		time.Sleep(5 * time.Second)
	}
}

func consumeCDCTopic(ctx context.Context) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{"localhost:9092"},
		Topic:       "dbserver1.public.users",
		GroupID:     "cdc-example-consumer",
		StartOffset: kafka.FirstOffset,
	})
	defer reader.Close()

	log.Println("CDC consumer started for topic dbserver1.public.users")
	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				log.Println("CDC consumer shutting down")
				return
			}
			log.Println("CDC consumer error:", err)
			time.Sleep(time.Second)
			continue
		}
		log.Printf("CDC event partition=%d offset=%d key=%s value=%s\n", msg.Partition, msg.Offset, string(msg.Key), string(msg.Value))
	}
}
