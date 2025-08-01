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

type NotificationSentHandler struct {
	orderService services.OrderService
	msgValidator *validator.Validator
}

type NotificationSentItemsInput struct {
	ProductID string
	Quantity  int32
	Price     float64
	Currency  string
}

type NotificationSentEventDetail struct {
	UserID    string                        `json:"userId" validate:"required"`
	Items     []*NotificationSentItemsInput `json:"items" validate:"required,dive"`
	Reason    string                        `json:"reason,omitempty"`
	CreatedAt string                        `json:"createdAt,omitempty"`
	UpdatedAt string                        `json:"updatedAt,omitempty"`
}

func NewNotificationSentHandler(orderService services.OrderService, msgValidator *validator.Validator) *NotificationSentHandler {
	return &NotificationSentHandler{
		orderService: orderService,
		msgValidator: msgValidator,
	}
}

func (h *NotificationSentHandler) HandleMessage(ctx context.Context, event *models.Event) error {
	detail := validator.ValidateModel(h.msgValidator, event.Detail, &NotificationSentEventDetail{})
	if detail == nil {
		return fmt.Errorf("failed to validate event: %s", enums.EVENT_TYPE.NotificationSentSuccess.String())
	}

	items := validator.ValidateModel(h.msgValidator, detail.Items, &[]services.OrderItemInput{})
	if items == nil {
		return fmt.Errorf("failed to validate items in event: %s , body incorrect", enums.EVENT_TYPE.NotificationSentSuccess.String())
	}

	log.Println("Handling NotificationSent event")

	userUUID, err := uuid.Parse(detail.UserID)
	if err != nil {
		return fmt.Errorf("failed to validate items in event: %s , uuid not correct", enums.EVENT_TYPE.NotificationSentSuccess.String())

	}
	order, err := h.orderService.HandleOrderProcessingNotificationSentEvent(ctx, userUUID)
	if err != nil {
		return fmt.Errorf("error creating order: %v", err)
	}

	log.Printf("Order created successfully: %+v\n", order)
	return nil
}
