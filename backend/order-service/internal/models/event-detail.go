package models

type EventDetail struct {
	ID        string `json:"id" validate:"required"`
	UserID    string `json:"user_id"`
	ProductID string `json:"productId" validate:"required"`
	Quantity  int32  `json:"quantity" validate:"required,gte=1"`
	Status    string `json:"status" validate:"required"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}
