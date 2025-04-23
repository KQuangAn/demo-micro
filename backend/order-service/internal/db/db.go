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

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse pgx config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create db pool: %w", err)
	}

	log.Println("Connected to the database")

	return &DBPool{Pool: pool}, nil
}

func (db *DBPool) Close() {
	if db.Pool != nil {
		db.Pool.Close()
		log.Println("Database connection pool closed")
	}
}
