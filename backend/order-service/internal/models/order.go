package models

import (
	"orderservice/graph/model"
	"time"

	"github.com/google/uuid"
)

type Order struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ToModelOrder converts persistence Order to GraphQL model.Order
func (o *Order) ToModelOrder() *model.Order {
	if o == nil {
		return nil
	}
	return &model.Order{
		ID:        o.ID,
		UserID:    o.UserID,
		CreatedAt: o.CreatedAt,
		UpdatedAt: o.UpdatedAt,
	}
}
