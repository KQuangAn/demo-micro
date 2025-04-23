package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"orderservice/graph/model"

	"orderservice/internal/eventbridge"
	"orderservice/pkg/enums"
	"os"

	"github.com/google/uuid"
	pgx "github.com/jackc/pgx/v5"
	pgxpool "github.com/jackc/pgx/v5/pgxpool"

	"github.com/aws/aws-sdk-go-v2/aws"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

type OrderService struct {
	DB *pgxpool.Pool
}

func NewOrderService(db *pgxpool.Pool) *OrderService {
	return &OrderService{DB: db}
}

func (s *OrderService) GetAllOrders(ctx context.Context) ([]*model.Order, error) {
	rows, err := s.DB.Query(ctx, "SELECT id, product_id, quantity, status FROM orders")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch orders: %v", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		var o model.Order
		if err := rows.Scan(&o.ID, &o.ProductID, &o.Quantity, &o.Status); err != nil {
			return nil, fmt.Errorf("failed to scan order: %v", err)
		}
		orders = append(orders, &o)
	}
	return orders, nil
}

func (s *OrderService) GetOrderByID(ctx context.Context, id string) (*model.Order, error) {
	var order model.Order
	err := s.DB.QueryRow(ctx, "SELECT id, product_id, quantity, status FROM orders WHERE id = $1", id).Scan(&order.ID, &order.ProductID, &order.Quantity, &order.Status)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}
	return &order, nil
}

func (s *OrderService) CreateOrder(ctx context.Context, userId string, productID string, quantity int32) (*model.Order, error) {
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %v", err)
	}
	defer tx.Rollback(ctx)

	userId = uuid.NewString()

	order := model.Order{
		UserID:    userId,
		ProductID: productID,
		Quantity:  quantity,
		Status:    model.OrderStatus(enums.Pending.String()),
	}

	_, err = tx.Exec(ctx, `INSERT INTO orders (user_id , product_id, quantity, status) VALUES ($1, $2, $3, $4)`,
		userId, order.ProductID, order.Quantity, order.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %v", err)
	}

	// Emit order created event
	detailJSON, err := json.Marshal(order)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderCreatedEvent := ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(string(enums.EVENT_TYPE.OrderPlaced)),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(orderCreatedEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to EventBridge: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &order, nil
}

func (s *OrderService) UpdateOrder(ctx context.Context, id string, productID string, quantity int32, status model.OrderStatus) (*model.Order, error) {
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	order := model.Order{
		ID:        id,
		ProductID: productID,
		Quantity:  quantity,
		Status:    status,
	}

	_, err = tx.Exec(ctx, `UPDATE orders SET product_id = $1, quantity = $2, status = $3 WHERE id = $4`,
		order.ProductID, order.Quantity, order.Status, order.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to update order: %v", err)
	}
	// emit order created event
	detail := model.Order{
		ID:        order.ID,
		ProductID: order.ProductID,
		Quantity:  order.Quantity,
		Status:    order.Status,
	}

	detailJSON, err := json.Marshal(detail)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
	}

	OrderPlacedEvent := ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(string(enums.EVENT_TYPE.OrderUpdated)),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
	}

	err = eventbridge.SendEvent(OrderPlacedEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to SQS: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	return &order, nil
}

func (s *OrderService) CancelOrder(ctx context.Context, id string) (*model.Order, error) {
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	var order model.Order
	err = tx.QueryRow(ctx, `SELECT id, product_id, quantity, status FROM orders WHERE id = $1`, id).Scan(&order.ID, &order.ProductID, &order.Quantity, &order.Status)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatus(enums.Cancelled.String())

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, order.Status, order.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %v", err)
	}

	// Emit order updated event
	detail := model.Order{
		ID:        order.ID,
		ProductID: order.ProductID,
		Quantity:  order.Quantity,
		Status:    order.Status,
	}

	detailJSON, err := json.Marshal(detail)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return nil, err
	}

	orderUpdatedEvent := ebTypes.PutEventsRequestEntry{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(string(enums.EVENT_TYPE.OrderCancelled)), // Use appropriate event type
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

	return &order, nil
}
