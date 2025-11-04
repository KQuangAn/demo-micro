package models

import (
	"time"

	"github.com/google/uuid"
)

type OrderDetail struct {
	ID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	// Column name appears to be orders_id based on repository queries; map explicitly
	OrderID    uuid.UUID `gorm:"column:orders_id;type:uuid"`
	ProductID  uuid.UUID
	Quantity   int
	Price      float64
	CurrencyID uuid.UUID
	Status     string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
