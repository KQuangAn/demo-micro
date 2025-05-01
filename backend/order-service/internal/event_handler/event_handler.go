package eventhandler

import (
	"context"
	"log"
	"orderservice/internal/models"
	"orderservice/internal/validator"
)

type EventHandler struct {
	registry  *HandlerRegistry
	validator *validator.Validator
}

func NewEventHandler(registry *HandlerRegistry, v *validator.Validator) *EventHandler {
	return &EventHandler{registry: registry, validator: v}
}

func (h *EventHandler) HandleMessage(ctx context.Context, msg any) error {
	event := validator.ValidateModel(h.validator, msg, &models.Event{})
	if event == nil {
		log.Println("Event validation failed")
		return nil
	}

	handler := h.registry.GetHandler(event.DetailType)
	if handler == nil {
		log.Printf("No handler for event type: %s", event.DetailType)
		return nil
	}

	return handler.HandleMessage(ctx, event)
}
