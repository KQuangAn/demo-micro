package models

import (
	"time"

	"github.com/google/uuid"
)

type OrderDetail struct {
	ID         uuid.UUID
	OrderID    uuid.UUID
	ProductID  uuid.UUID
	Quantity   int
	Price      float64
	CurrencyID uuid.UUID
	Status     string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}