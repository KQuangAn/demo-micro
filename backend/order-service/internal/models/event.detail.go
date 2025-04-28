package models

type NotificationEventDetail struct {
	ID        string `json:"id" validate:"required"`
	UserID    string `json:"user_id"`
	ProductID string `json:"productId"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type InventoryReservedEventDetail struct {
	OrderID   string `json:"orderId" validate:"required"`
	ProductID string `json:"productId"`
	Title     string `json:"title"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// add more
}
type InventoryReservedFailEventDetail struct {
	OrderID   string `json:"orderId" validate:"required"`
	ProductID string `json:"productId"`
	Title     string `json:"title"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// add more
}
