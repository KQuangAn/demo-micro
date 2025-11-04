package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DBPool struct {
	DB *gorm.DB
}

func NewDBPool(ctx context.Context) (*DBPool, error) {
	url := os.Getenv("DATABASE_URL")
	user := os.Getenv("DATABASE_USERNAME")
	password := os.Getenv("DATABASE_PASSWORD")
	dbName := os.Getenv("DATABASE_NAME")

	connStr := fmt.Sprintf("host=%s user=%s password=%s dbname=%s sslmode=disable", url, user, password, dbName)

	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := configureConnectionPool(db); err != nil {
		return nil, err
	}

	log.Println("Connected to the database")

	return &DBPool{DB: db}, nil
}

// Close gracefully closes the underlying sql.DB pool.
func (p *DBPool) Close() error {
	if p == nil || p.DB == nil {
		return nil
	}
	sqlDB, err := p.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func configureConnectionPool(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	maxOpen := getEnvAsInt("DB_MAX_OPEN_CONNS", 20)
	maxIdle := getEnvAsInt("DB_MAX_IDLE_CONNS", 10)
	maxLifetimeMin := getEnvAsInt("DB_CONN_MAX_LIFETIME_MIN", 30)
	maxIdleTimeMin := getEnvAsInt("DB_CONN_MAX_IDLE_TIME_MIN", 10)

	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetConnMaxLifetime(time.Duration(maxLifetimeMin) * time.Minute)
	// Go 1.17+: limit idle time explicitly
	setConnMaxIdleTime(sqlDB, time.Duration(maxIdleTimeMin)*time.Minute)

	log.Printf("DB pool configured: maxOpen=%d, maxIdle=%d, lifetime=%dm, idleTime=%dm\n", maxOpen, maxIdle, maxLifetimeMin, maxIdleTimeMin)
	return nil
}

func getEnvAsInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

// setConnMaxIdleTime wraps sql.DB.SetConnMaxIdleTime for portability
func setConnMaxIdleTime(db *sql.DB, d time.Duration) {
	// available since Go 1.15
	db.SetConnMaxIdleTime(d)
}
