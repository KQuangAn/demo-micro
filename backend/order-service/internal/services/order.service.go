package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"orderservice/graph/model"
	"orderservice/internal/eventbridge"
	"orderservice/internal/repository"
	"orderservice/pkg/enums"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
	"github.com/google/uuid"
)

type OrderService struct {
	repo repository.OrderRepository
}

func NewOrderService(repo repository.OrderRepository) *OrderService {
	return &OrderService{repo: repo}
}

func (s *OrderService) GetAllOrders(ctx context.Context) ([]*model.Order, error) {
	return s.repo.GetAllOrders(ctx)
}

func (s *OrderService) GetOrderByID(ctx context.Context, id string) (*model.Order, error) {
	return s.repo.GetOrderByID(ctx, id)
}

func (s *OrderService) CreateOrder(ctx context.Context, userId string, productID string, quantity int32) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	// Create order
	order := model.Order{
		UserID:    userId,
		ProductID: productID,
		Quantity:  quantity,
		Status:    model.OrderStatus(model.OrderStatusPending.String()),
	}

	createdOrder, err := s.repo.InsertOrder(ctx, tx, order)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %v", err)
	}

	// Emit order created event
	detailJSON, err := json.Marshal(createdOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}
	correlationID := uuid.New().String()

	orderCreatedEvent := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderPlaced.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
		TraceHeader:  aws.String(correlationID),
	}

	err = eventbridge.SendEvent(orderCreatedEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &createdOrder, nil
}

func (s *OrderService) UpdateOrder(ctx context.Context, id string, productID string, quantity int32, status model.OrderStatus) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	// Update order
	order := model.Order{
		ID:        id,
		ProductID: productID,
		Quantity:  quantity,
		Status:    status,
	}

	updatedOrder, err := s.repo.UpdateOrder(ctx, tx, order)
	if err != nil {
		return nil, fmt.Errorf("failed to update order: %v", err)
	}

	// Emit order updated event
	detailJSON, err := json.Marshal(updatedOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderUpdatedEvent := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderUpdated.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(orderUpdatedEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &updatedOrder, nil
}

func (s *OrderService) CancelOrder(ctx context.Context, id string) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatus(model.OrderStatusCancelled.String())

	updatedOrder, err := s.repo.UpdateOrder(ctx, tx, *order)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %v", err)
	}

	detailJSON, err := json.Marshal(updatedOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderCancelledEvent := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderCancelledByUser.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(orderCancelledEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &updatedOrder, nil
}

func (s *OrderService) CancelOrderInsufficentInventory(ctx context.Context, id string) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatus(model.OrderStatusCancelled.String())

	updatedOrder, err := s.repo.UpdateOrder(ctx, tx, *order)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %v", err)
	}

	detailJSON, err := json.Marshal(updatedOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderCancelledEvent := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderCancelledInsufficentInventory.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(orderCancelledEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &updatedOrder, nil
}

func (s *OrderService) HandleInventoryReservedEvent(ctx context.Context, id string, productID string, quantity int32) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatus(model.OrderStatusProcessing.String())

	updatedOrder, err := s.repo.UpdateOrder(ctx, tx, *order)
	if err != nil {
		return nil, fmt.Errorf("failed to update order: %v", err)
	}

	detailJSON, err := json.Marshal(updatedOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	event := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderProcessed.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(event)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &updatedOrder, nil
}

func (s *OrderService) HandleInventoryReservedFailedEvent(ctx context.Context, id string, productID string, quantity int32) (*model.Order, error) {
	tx, err := s.repo.BeginTransaction(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatus(model.OrderStatusCancelled.String())

	updatedOrder, err := s.repo.UpdateOrder(ctx, tx, *order)
	if err != nil {
		return nil, fmt.Errorf("failed to update order: %v", err)
	}

	detailJSON, err := json.Marshal(updatedOrder)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderUpdatedEvent := &ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(enums.EVENT_TYPE.OrderCancelledInsufficentInventory.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(orderUpdatedEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &updatedOrder, nil
}
