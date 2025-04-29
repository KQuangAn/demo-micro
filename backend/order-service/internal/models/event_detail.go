package models

type Detail struct {
	ID string `json:"id"`
}

type NotificationMessageDetail struct {
	Detail Detail `json:"detail"`
}

type NotificationEventDetail struct {
	SubjectId string `json:"subjectId" validate:"required"`
	EventType string `json:"type"`
	Message   string `json:"message"`
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
