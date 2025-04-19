package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect() error {
	var err error
	connStr := "postgres://user:password@localhost:5432/orders"
	Pool, err = pgxpool.New(context.Background(), connStr)
	return err
}
