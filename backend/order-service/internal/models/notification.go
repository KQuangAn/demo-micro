package models

type Notification struct {
	ID        string `json:"id" validate:"required"`
	Event     string `json:"event" validate:"required"`
	CreatedAt string `json:"createdAt" validate:"datetime"`
}
