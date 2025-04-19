package db

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DBPool struct {
	Pool *pgxpool.Pool
}

func NewDBPool(ctx context.Context) (*DBPool, error) {
	url := os.Getenv("DATABASE_URL")
	user := os.Getenv("DATABASE_USERNAME")
	password := os.Getenv("DATABASE_PASSWORD")
	dbName := os.Getenv("DATABASE_NAME")

	if url == "" || user == "" || password == "" || dbName == "" {
		return nil, fmt.Errorf("missing one or more required DB environment variables")
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s/%s", user, password, url, dbName)
	fmt.Println(connStr)
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse pgx config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create db pool: %w", err)
	}

	log.Println("Connected to the database")
	if err := testQuery(pool); err != nil {
		return nil, fmt.Errorf("failed to run test query: %w", err)
	}
	return &DBPool{Pool: pool}, nil
}
func testQuery(pool *pgxpool.Pool) error {
	// Simple query to check the connection
	rows, err := pool.Query(context.Background(), "SELECT NOW()")
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	// Read the result
	var currentTime string
	if rows.Next() {
		if err := rows.Scan(&currentTime); err != nil {
			return fmt.Errorf("failed to scan row: %w", err)
		}
	}

	log.Printf("Current time from DB: %s\n", currentTime)
	return nil
}
func (db *DBPool) Close() {
	if db.Pool != nil {
		db.Pool.Close()
		log.Println("Database connection pool closed")
	}
}
