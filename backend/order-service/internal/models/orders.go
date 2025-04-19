package models

type Order struct {
	ID        string `json:"id" validate:"required"`
	ProductID string `json:"productId" validate:"required"`
	Quantity  int32  `json:"quantity" validate:"required,gte=1"`
	Status    string `json:"status" validate:"required"`
}
