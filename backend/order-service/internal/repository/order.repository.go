package repository

import (
	"context"
	"fmt"
	"orderservice/graph/model"
	"time"

	"github.com/google/uuid"

	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderRepository interface {
	InsertOrder(ctx context.Context, tx pgx.Tx, order model.Order) (model.Order, error)
	GetAllOrders(ctx context.Context) ([]*model.Order, error)
	GetOrderByID(ctx context.Context, id string) (*model.Order, error)
	UpdateOrder(ctx context.Context, tx pgx.Tx, order model.Order) (model.Order, error)
	CancelOrder(ctx context.Context, tx pgx.Tx, id string) (*model.Order, error)
	BeginTransaction(ctx context.Context) (pgx.Tx, error)
}

type orderRepository struct {
	db *pgxpool.Pool
}

func NewOrderRepository(db *pgxpool.Pool) OrderRepository {
	return &orderRepository{db: db}
}

func (r *orderRepository) BeginTransaction(ctx context.Context) (pgx.Tx, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %v", err)
	}
	return tx, nil
}
func (r *orderRepository) InsertOrder(ctx context.Context, tx pgx.Tx, order model.Order) (model.Order, error) {
	var id uuid.UUID
	var createdAt, updatedAt time.Time

	err := tx.QueryRow(ctx, `INSERT INTO orders (user_id, product_id, quantity, status) 
							VALUES ($1, $2, $3, $4) 
							RETURNING id, created_at, updated_at`,
		order.UserID, order.ProductID, order.Quantity, order.Status).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		return model.Order{}, fmt.Errorf("failed to insert order: %v", err)
	}

	order.ID = id.String()
	order.CreatedAt = createdAt.Format(time.RFC3339)
	order.UpdatedAt = updatedAt.Format(time.RFC3339)

	return order, nil
}

func (r *orderRepository) GetAllOrders(ctx context.Context) ([]*model.Order, error) {
	rows, err := r.db.Query(ctx, "SELECT id, user_id, product_id, quantity, status, created_at, updated_at FROM orders")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch orders: %v", err)
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		var order model.Order
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity, &order.Status, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan order: %v", err)
		}

		order.CreatedAt = createdAt.Format(time.RFC3339)
		order.UpdatedAt = updatedAt.Format(time.RFC3339)

		orders = append(orders, &order)
	}
	return orders, nil
}

func (r *orderRepository) GetOrderByID(ctx context.Context, id string) (*model.Order, error) {
	var order model.Order
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, "SELECT id, user_id, product_id, quantity, status, created_at, updated_at FROM orders WHERE id = $1", id).Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity, &order.Status, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.CreatedAt = createdAt.Format(time.RFC3339)
	order.UpdatedAt = updatedAt.Format(time.RFC3339)

	return &order, nil
}

func (r *orderRepository) UpdateOrder(ctx context.Context, tx pgx.Tx, order model.Order) (model.Order, error) {
	_, err := tx.Exec(ctx, `UPDATE orders SET product_id = $1, quantity = $2, status = $3 WHERE id = $4`,
		order.ProductID, order.Quantity, order.Status, order.ID)
	if err != nil {
		return model.Order{}, fmt.Errorf("failed to update order: %v", err)
	}

	return order, nil
}

func (r *orderRepository) CancelOrder(ctx context.Context, tx pgx.Tx, id string) (*model.Order, error) {
	var order model.Order
	var createdAt, updatedAt time.Time
	err := tx.QueryRow(ctx, `SELECT id, user_id, product_id, quantity, status, created_at, updated_at FROM orders WHERE id = $1`, id).Scan(&order.ID, &order.UserID, &order.ProductID, &order.Quantity, &order.Status, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("order not found: %v", err)
	}

	order.Status = model.OrderStatusCancelled
	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1 WHERE id = $2`, order.Status, order.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %v", err)
	}

	order.CreatedAt = createdAt.Format(time.RFC3339)
	order.UpdatedAt = updatedAt.Format(time.RFC3339)

	return &order, nil
}
