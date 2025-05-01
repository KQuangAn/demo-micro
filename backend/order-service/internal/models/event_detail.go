package models

type Detail struct {
	ID string `json:"id"`
}

type NotificationMessageDetail struct {
	Detail Detail `json:"detail"`
}

type NotificationEventDetail struct {
	SubjectID string `json:"subjectId" validate:"required"`
	EventType string `json:"type"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type InventoryItem struct {
	UserID    string `json:"userId" validate:"required"`
	ProductID string `json:"productId"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Price     int32  `json:"price" validate:"gte=1"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// add more
}

type InventoryReservedEventDetail struct {
	UserID    string `json:"userId" validate:"required"`
	ProductID string `json:"productId"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Price     int32  `json:"price" validate:"gte=1"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// add more
}
type InventoryReservedFailEventDetail struct {
	UserID    string `json:"orderId" validate:"required"`
	ProductID string `json:"productId"`
	Title     string `json:"title"`
	Quantity  int32  `json:"quantity" validate:"gte=1"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	// add more
}
