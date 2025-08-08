package models

import (
	"time"
)

type Order struct {
	ID        uint `gorm:"primaryKey"`
	UserID    uint
	CreatedAt time.Time
	UpdatedAt time.Time
}
