package repository

import (
	"context"
	"fmt"
	"orderservice/graph/model"
	"orderservice/internal/utils"
	"strings"
	"time"

	"github.com/google/uuid"
	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "PENDING"
	OrderStatusCancelled OrderStatus = "CANCELLED"
	OrderStatusShipped   OrderStatus = "SHIPPED"
)

type Order struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

type OrderDetail struct {
	ID         uuid.UUID
	OrderID    uuid.UUID
	ProductID  uuid.UUID
	Quantity   int
	Price      float64
	CurrencyID uuid.UUID
	Status     string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Currency struct {
	ID        uuid.UUID
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}
type CurrencyLookup struct {
	IDToName map[uuid.UUID]string
	NameToID map[string]uuid.UUID
}

type OrderRepository interface {
	GetAllOrders(
		ctx context.Context,
		tx pgx.Tx,
		first *int32, after *time.Time,
	) ([]*Order, *time.Time, error)

	CreateOrder(ctx context.Context, tx pgx.Tx, user_id uuid.UUID, input []*OrderItemInput) (*Order, error)
	GetOrderByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error)

	//GetOrderByUserId(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error)
	//GetOrderWithDetailByOrderIdPaginated(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error)

	GetOrderDetailByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*OrderDetail, error)

	GetOrdersByUserId(
		ctx context.Context,
		tx pgx.Tx,
		userId uuid.UUID,
		first *int32,
		after *time.Time,
	) ([]*Order, *time.Time, error)
	GetOrdersByUserIdPaginated(
		ctx context.Context,
		tx pgx.Tx,
		userId uuid.UUID,
		limit *int32,
		after *time.Time,
	) ([]*Order, *time.Time, error)
	GetOrderDetailByOrderID(ctx context.Context, tx pgx.Tx, orderId uuid.UUID) ([]*OrderDetail, error)

	GetOrderDetailByOrderIDPaginated(ctx context.Context, tx pgx.Tx, orderId uuid.UUID, limit int32,
		after time.Time) ([]*OrderDetail, time.Time, error)

	UpdateOrderDetail(ctx context.Context, tx pgx.Tx, detail OrderDetail) (*OrderDetail, error)

	UpdateOrderStatus(ctx context.Context, tx pgx.Tx, orderDetailId uuid.UUID, status model.OrderDetailStatus) (*OrderDetail, error)

	CancelOrder(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error)
}

var (
	orderTableName       = "orders"
	orderDetailTableName = "order_details"
	currencyTable        = "currencies"
)

type orderRepository struct {
	db *pgxpool.Pool
}

func NewOrderRepository(db *pgxpool.Pool) OrderRepository {
	return &orderRepository{db: db}
}

func (o *Order) ToModelOrder() *model.Order {
	return &model.Order{
		ID:        o.ID,
		UserID:    o.UserID,
		CreatedAt: o.CreatedAt,
		UpdatedAt: o.UpdatedAt,
	}
}
func (d *OrderDetail) ToModelOrderDetail(currencyName string) *model.OrderDetail {
	return &model.OrderDetail{
		ID:        d.ID,
		OrderID:   d.OrderID,
		ProductID: d.ProductID,
		Quantity:  int32(d.Quantity),
		Price:     d.Price,
		Currency:  currencyName,
		Status:    model.OrderDetailStatus(d.Status),
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	}
}

func NewCurrencyLookup(currencies []*Currency) *CurrencyLookup {
	lookup := &CurrencyLookup{
		IDToName: make(map[uuid.UUID]string),
		NameToID: make(map[string]uuid.UUID),
	}
	for _, c := range currencies {
		lookup.IDToName[c.ID] = c.Name
		lookup.NameToID[c.Name] = c.ID
	}
	return lookup
}

func buildCursorCondition(after, before time.Time, startIndex int) (string, []any) {
	var cursorConditions []string
	var args []any
	argIndex := startIndex

	if !after.IsZero() {
		cursorConditions = append(cursorConditions, fmt.Sprintf("created_at > $%d", argIndex))
		args = append(args, after)
		argIndex++
	}
	if !before.IsZero() {
		cursorConditions = append(cursorConditions, fmt.Sprintf("created_at < $%d", argIndex))
		args = append(args, before)
		argIndex++
	}

	// Join conditions with AND
	var condition string
	if len(cursorConditions) > 0 {
		condition = "AND " + strings.Join(cursorConditions, " AND ")
	}

	return condition, args
}

// Helper function to query from tx or pool
func (r *orderRepository) query(ctx context.Context, tx pgx.Tx, sql string, args ...any) (pgx.Rows, error) {
	if tx != nil {
		return tx.Query(ctx, sql, args...)
	}
	return r.db.Query(ctx, sql, args...)
}

func (r *orderRepository) queryRow(ctx context.Context, tx pgx.Tx, sql string, args ...any) pgx.Row {
	if tx != nil {
		return tx.QueryRow(ctx, sql, args...)
	}
	return r.db.QueryRow(ctx, sql, args...)
}

type OrderItemInput struct {
	ProductID string
	Quantity  int32
	Price     float64
	Currency  string
}

func (r *orderRepository) CreateOrder(ctx context.Context, tx pgx.Tx, user_id uuid.UUID, items []*OrderItemInput) (*Order, error) {
	var order Order
	order.UserID = user_id

	query := fmt.Sprintf(`
		INSERT INTO %s (user_id)
		VALUES ($1)
		RETURNING id, created_at, updated_at`, orderTableName)

	err := tx.QueryRow(ctx, query,
		user_id).Scan(&order.ID, &order.CreatedAt, &order.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to insert order: %w", err)
	}

	//get currencies

	query = fmt.Sprintf(`
		SELECT id, name, created_at, updated_at
		FROM %s`, currencyTable)

	rows, err := r.query(ctx, tx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch currencies: %w", err)
	}
	defer rows.Close()

	var currencies []*Currency
	for rows.Next() {
		var currency Currency
		if err := rows.Scan(&currency.ID, &currency.Name, &currency.CreatedAt, &currency.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan currency: %w", err)
		}
		currencies = append(currencies, &currency)
	}

	lookup := NewCurrencyLookup(currencies)

	// create order details
	var orderDetails []*OrderDetail
	for _, item := range items {
		productUUID, err := uuid.Parse(item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("invalid productID: %v", err)
		}
		currencyId, exists := lookup.NameToID[item.Currency]

		if !exists {
			continue
		}
		orderDetails = append(orderDetails, &OrderDetail{
			OrderID:    order.ID,
			ProductID:  productUUID,
			Quantity:   int(item.Quantity),
			Price:      item.Price,
			CurrencyID: currencyId,
			Status:     string(model.OrderDetailStatusPending),
		})

	}

	rowsDetails := make([][]any, len(orderDetails))
	for i, d := range orderDetails {
		rowsDetails[i] = []any{
			d.OrderID,
			d.ProductID,
			d.Quantity,
			d.Price,
			d.CurrencyID,
			d.Status,
		}
	}

	copyCount, err := tx.CopyFrom(
		ctx,
		pgx.Identifier{orderDetailTableName},
		[]string{"orders_id", "product_id", "quantity", "price", "currency_id", "status"},
		pgx.CopyFromRows(rowsDetails),
	)
	if err != nil {
		return nil, fmt.Errorf("copy from failed: %w", err)
	}

	if int(copyCount) != len(orderDetails) {
		return nil, fmt.Errorf("expected to insert %d rows, but inserted %d", len(orderDetails), copyCount)
	}

	orderID := orderDetails[0].OrderID
	_, err = r.GetOrderDetailByOrderID(ctx, tx, orderID)
	if err != nil {
		return nil, fmt.Errorf("fetching inserted order details failed: %w", err)
	}

	return &order, nil
}

func (r *orderRepository) GetOrdersByUserId(
	ctx context.Context,
	tx pgx.Tx,
	userId uuid.UUID,
	first *int32,
	after *time.Time,
) ([]*Order, *time.Time, error) {

	query := fmt.Sprintf(`
		SELECT id, user_id, created_at, updated_at 
		FROM %s 
		WHERE user_id = $1 
	`, orderTableName)
	query, params := utils.BuildPaginationQuery(query, after, first, "created_at", 2)
	fmt.Println(query, "fqnqwekfnk")
	params = append([]any{userId}, params...)

	rows, err := tx.Query(ctx, query, params...)
	if err != nil {
		return nil, nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var orders []*Order
	var next *time.Time
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, nil, fmt.Errorf("failed to scan row: %w", err)
		}
		orders = append(orders, &o)
		next = &o.CreatedAt
	}

	return orders, next, nil
}

func (r *orderRepository) GetAllOrders(
	ctx context.Context,
	tx pgx.Tx,
	first *int32, after *time.Time,
) ([]*Order, *time.Time, error) {

	baseQuery := `
			SELECT
				o.id,
				o.user_id,
				o.created_at,
				o.updated_at
			FROM orders o
		`

	query, params := utils.BuildPaginationQuery(baseQuery, after, first, "o.created_at", 1)

	rows, err := tx.Query(ctx, query, params...)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer rows.Close()

	var orders []*Order
	var next *time.Time
	for rows.Next() {
		var order Order
		if err := rows.Scan(
			&order.ID,
			&order.UserID,
			&order.CreatedAt,
			&order.UpdatedAt,
		); err != nil {
			return nil, nil, fmt.Errorf("failed to scan row: %v", err)
		}

		orders = append(orders, &order)
		next = &order.CreatedAt
	}

	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("rows iteration error: %v", err)
	}

	return orders, next, nil
}

func (r *orderRepository) GetOrdersByUserIdPaginated(
	ctx context.Context,
	tx pgx.Tx,
	userId uuid.UUID,
	limit *int32,
	after *time.Time,
) ([]*Order, *time.Time, error) {
	baseArgs := []any{userId}

	// Use the helper to build the cursor condition and arguments
	cursorCondition, cursorArgs := buildCursorCondition(*after, time.Time{}, 2)

	args := append(baseArgs, cursorArgs...)
	args = append(args, limit)

	query := fmt.Sprintf(`
		SELECT id, user_id, created_at, updated_at 
		FROM orders 
		WHERE user_id = $1 %s
		ORDER BY created_at ASC 
		LIMIT $%d
	`, cursorCondition, len(args))

	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return nil, &time.Time{}, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var orders []*Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, &time.Time{}, fmt.Errorf("failed to scan row: %w", err)
		}
		orders = append(orders, &o)
	}

	var nextCursor time.Time
	if len(orders) > 0 {
		nextCursor = orders[len(orders)-1].CreatedAt
	}

	return orders, &nextCursor, nil
}

func (r *orderRepository) GetOrderByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error) {
	query := fmt.Sprintf(`
		SELECT id, user_id created_at, updated_at
		FROM %s WHERE id = $1`, orderTableName)

	var order Order
	err := r.queryRow(ctx, tx, query, id).Scan(
		&order.ID, &order.UserID,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	return &order, nil
}

func (r *orderRepository) GetOrderDetailByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*OrderDetail, error) {
	query := fmt.Sprintf(`
		SELECT id, orders_id, product_id, quantity, price, currency_id, status, created_at, updated_at
		FROM %s WHERE id = $1`, orderDetailTableName)

	var d OrderDetail
	err := r.queryRow(ctx, tx, query, id).Scan(
		&d.ID, &d.OrderID, &d.ProductID, &d.Quantity,
		&d.Price, &d.CurrencyID, &d.Status, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("not found: %v", err)
	}

	return &d, nil
}

// todo
func (r *orderRepository) GetOrderByIDPaginated(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error) {
	query := fmt.Sprintf(`
		SELECT id, user_id created_at, updated_at
		FROM %s WHERE id = $1`, orderTableName)

	var order Order
	err := r.queryRow(ctx, tx, query, id).Scan(
		&order.ID, &order.UserID,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	return &order, nil
}

func (r *orderRepository) UpdateOrderStatus(ctx context.Context, tx pgx.Tx, orderDetailId uuid.UUID, status model.OrderDetailStatus) (*OrderDetail, error) {
	query := fmt.Sprintf(`
		UPDATE %s SET status = $1, updated_at = NOW()
		WHERE id = $2`, orderDetailTableName)

	_, err := tx.Exec(ctx, query, status.String(), orderDetailId)

	if err != nil {
		return nil, fmt.Errorf("failed to update order: %w", err)
	}

	return r.GetOrderDetailByID(ctx, tx, orderDetailId)
}

func (r *orderRepository) CancelOrder(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*Order, error) {
	order, err := r.GetOrderByID(ctx, tx, id)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`UPDATE %s SET status = %s WHERE orders_id = $1`, orderDetailTableName, model.OrderDetailStatusCancelled.String())
	_, err = tx.Exec(ctx, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel order: %w", err)
	}

	order.UpdatedAt = time.Now()

	return order, nil
}

func (r *orderRepository) UpdateOrderDetail(ctx context.Context, tx pgx.Tx, detail OrderDetail) (*OrderDetail, error) {
	query := fmt.Sprintf(`
		UPDATE %s 
		SET product_id = $1, quantity = $2, price = $3, currency_id  = $4 , status = $5 
		WHERE id = $6`, orderDetailTableName)

	_, err := tx.Exec(ctx, query,
		detail.ProductID, detail.Quantity, detail.Price, detail.CurrencyID, detail.Status, detail.ID)
	if err != nil {
		return nil, fmt.Errorf("update failed: %v", err)
	}

	return &detail, nil
}

func (r *orderRepository) GetOrderDetailByOrderID(ctx context.Context, tx pgx.Tx, orderId uuid.UUID) ([]*OrderDetail, error) {

	query := fmt.Sprintf(`
		SELECT id, orders_id, product_id, quantity, price,currency_id, status, created_at, updated_at 
		FROM %s WHERE orders_id = $1`, orderDetailTableName)

	rows, err := r.query(ctx, tx, query, orderId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if err != nil {
		return nil, fmt.Errorf("not found: %v", err)
	}
	var orderDetail []*OrderDetail

	//transform
	for rows.Next() {
		var o OrderDetail
		if err := rows.Scan(
			&o.ID, &o.OrderID, &o.ProductID, &o.Quantity,
			&o.Price, &o.CurrencyID, &o.Status, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		orderDetail = append(orderDetail, &o)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return orderDetail, nil
}
func (r *orderRepository) GetOrderDetailByOrderIDPaginated(
	ctx context.Context,
	tx pgx.Tx,
	orderId uuid.UUID,
	limit int32,
	after time.Time) ([]*OrderDetail, time.Time, error) {

	baseArgs := []any{orderId}

	var cursorCondition string
	if !after.IsZero() {
		cursorCondition = "AND created_at > $2"
		baseArgs = append(baseArgs, after)
	}

	args := append(baseArgs, limit)

	query := fmt.Sprintf(`
		SELECT id, orders_id, product_id, quantity, price, currency_id, status, created_at, updated_at 
		FROM %s 
		JOIN currencies ON orders_id = $1 %s
		ORDER BY created_at ASC
		LIMIT $%d`,
		orderDetailTableName, cursorCondition, len(args))

	rows, err := r.query(ctx, tx, query, args...)
	if err != nil {
		return nil, time.Time{}, err
	}
	defer rows.Close()

	var orderDetail []*OrderDetail
	var nextCursor time.Time
	for rows.Next() {
		var o OrderDetail
		if err := rows.Scan(
			&o.ID, &o.OrderID, &o.ProductID, &o.Quantity,
			&o.Price, &o.CurrencyID, &o.Status, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, time.Time{}, fmt.Errorf("failed to scan row: %w", err)
		}
		orderDetail = append(orderDetail, &o)
		nextCursor = o.CreatedAt
	}

	if err := rows.Err(); err != nil {
		return nil, time.Time{}, fmt.Errorf("row iteration error: %w", err)
	}

	return orderDetail, nextCursor, nil
}
