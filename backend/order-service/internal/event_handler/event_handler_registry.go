package eventhandler

import (
	"context"
	"orderservice/internal/models"
)

type Handler interface {
	HandleMessage(ctx context.Context, event *models.Event) error
}

type HandlerRegistry struct {
	handlers map[string]Handler
}

func NewHandlerRegistry() *HandlerRegistry {
	return &HandlerRegistry{
		handlers: make(map[string]Handler),
	}
}

func (r *HandlerRegistry) Register(eventType string, handler Handler) {
	r.handlers[eventType] = handler
}

func (r *HandlerRegistry) GetHandler(eventType string) Handler {
	return r.handlers[eventType]
}
