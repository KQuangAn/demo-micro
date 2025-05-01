package eventhandler

import (
	"context"
	"fmt"
	"log"
	"orderservice/internal/models"
	"orderservice/internal/services"
	"orderservice/internal/validator"
	"orderservice/pkg/enums"

	"github.com/google/uuid"
)

type InventoryReservedHandler struct {
	orderService services.OrderService
	msgValidator *validator.Validator
}

type InventoryReservedItemsInput struct {
	ProductID string
	Quantity  int32
	Price     float64
	Currency  string
}

type InventoryReservedEventDetail struct {
	UserID    string                         `json:"userId" validate:"required"`
	Items     []*InventoryReservedItemsInput `json:"items" validate:"required,dive"`
	Reason    string                         `json:"reason,omitempty"`
	CreatedAt string                         `json:"createdAt,omitempty"`
	UpdatedAt string                         `json:"updatedAt,omitempty"`
}

func NewInventoryReservedHandler(orderService services.OrderService, msgValidator *validator.Validator) *InventoryReservedHandler {
	return &InventoryReservedHandler{
		orderService: orderService,
		msgValidator: msgValidator,
	}
}

func (h *InventoryReservedHandler) HandleMessage(ctx context.Context, event *models.Event) error {
	detail := validator.ValidateModel(h.msgValidator, event.Detail, &InventoryReservedEventDetail{})
	if detail == nil {
		return fmt.Errorf("failed to validate event: %s", enums.EVENT_TYPE.InventoryReserved.String())
	}

	items := validator.ValidateModel(h.msgValidator, detail.Items, &[]services.OrderItemInput{})
	if items == nil {
		return fmt.Errorf("failed to validate items in event: %s , body incorrect", enums.EVENT_TYPE.InventoryReserved.String())
	}

	log.Println("Handling InventoryReserved event")

	userUUID, err := uuid.Parse(detail.UserID)
	if err != nil {
		return fmt.Errorf("failed to validate items in event: %s , uuid not correct", enums.EVENT_TYPE.InventoryReserved.String())

	}
	order, err := h.orderService.HandleInventoryReservedEvent(ctx, userUUID, *items)
	if err != nil {
		return fmt.Errorf("error creating order: %v", err)
	}

	log.Printf("Order created successfully: %+v\n", order)
	return nil
}
