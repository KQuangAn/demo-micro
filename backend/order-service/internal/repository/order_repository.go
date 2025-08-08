package repository

import (
	"context"
	"fmt"
	"orderservice/graph/model"
	"orderservice/internal/models"
	"orderservice/internal/utils"
	"strings"
	"time"

	"github.com/google/uuid"
	pgx "github.com/jackc/pgx/v5"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "PENDING"
	OrderStatusCancelled OrderStatus = "CANCELLED"
	OrderStatusShipped   OrderStatus = "SHIPPED"
)

type CurrencyLookup struct {
	IDToName map[uuid.UUID]string
	NameToID map[string]uuid.UUID
}

type OrderRepository interface {
	GetAllOrders(
		ctx context.Context,
		tx *gorm.DB,
		first *int32, after *time.Time,
	) ([]*models.Order, *time.Time, error)

	CreateOrder(ctx context.Context, tx *gorm.DB, user_id uuid.UUID, input []*OrderItemInput) (*models.Order, error)
	GetOrderByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error)

	//GetOrderByUserId(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order ,  error)
	//GetOrderWithDetailByOrderIdPaginated(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order ,  error)

	GetOrderDetailByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.OrderDetail, error)

	GetOrdersByUserId(
		ctx context.Context,
		tx *gorm.DB,
		userId uuid.UUID,
		first *int32,
		after *time.Time,
	) ([]*models.Order, *time.Time, error)
	GetOrdersByUserIdPaginated(
		ctx context.Context,
		tx *gorm.DB,
		userId uuid.UUID,
		limit *int32,
		after *time.Time,
	) ([]*models.Order, *time.Time, error)
	GetOrderDetailByOrderID(ctx context.Context, tx *gorm.DB, orderId uuid.UUID) ([]*models.OrderDetail, error)

	GetOrderDetailByOrderIDPaginated(ctx context.Context, tx *gorm.DB, orderId uuid.UUID, limit int32,
		after time.Time) ([]*models.OrderDetail, time.Time, error)

	UpdateOrderDetail(ctx context.Context, tx *gorm.DB, detail models.OrderDetail) (*models.OrderDetail, error)

	UpdateOrderStatus(ctx context.Context, tx *gorm.DB, orderDetailId uuid.UUID, status model.OrderDetailStatus) (*models.OrderDetail, error)

	CancelOrder(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error)
}

var (
	orderTableName       = "orders"
	orderDetailTableName = "order_details"
	currencyTable        = "currencies"
)

type orderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db: db}
}

func NewCurrencyLookup(currencies []*models.Currency) *CurrencyLookup {
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

type OrderItemInput struct {
	ProductID string
	Quantity  int32
	Price     float64
	Currency  string
}

func (r *orderRepository) CreateOrder(ctx context.Context, tx *gorm.DB, user_id uuid.UUID, items []*OrderItemInput) (*models.Order, error) {
	var order Order
	order.UserID = user_id

	order = Order{UserID: user_id, CreatedAt: time.Now(), UpdatedAt: time.Now()}

	result := tx.Create(&order)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to insert order: %w", result.Error.Error())
	}

	query = fmt.Sprintf(`
		SELECT id, name, created_at, updated_at
		FROM %s`, currencyTable)

	rows, err := r.query(ctx, tx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch currencies: %w", err)
	}
	defer rows.Close()

	var currencies []*models.Currency
	for rows.Next() {
		var currency models.Currency
		if err := rows.Scan(&currency.ID, &currency.Name, &currency.CreatedAt, &currency.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan currency: %w", err)
		}
		currencies = append(currencies, &currency)
	}

	lookup := NewCurrencyLookup(currencies)

	// create order details
	var orderDetails []*models.OrderDetail
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
	tx *gorm.DB,
	userId uuid.UUID,
	first *int32,
	after *time.Time,
) ([]*models.Order, *time.Time, error) {

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

	var orders []*models.Order
	var next *time.Time
	for rows.Next() {
		var o models.Order
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
	tx *gorm.DB,
	first *int32, after *time.Time,
) ([]*models.Order, *time.Time, error) {
	var orders []*models.Order

	query := tx.Order("created_at ASC")

	if after != nil {
		query = query.Where("created_at > ?", *after)
	}

	if first != nil {
		query = query.Limit(int(*first))
	} else {
		query = query.Limit(10)
	}

	result := query.Find(&orders)
	if result.Error != nil {
		return nil, nil, fmt.Errorf("failed to execute query: %v", result.Error)
	}

	var nextCursor *time.Time
	if len(orders) > 0 {
		nextCursor = &orders[len(orders)-1].CreatedAt
	}

	return orders, nextCursor, nil
}

func (r *orderRepository) GetOrdersByUserIdPaginated(
	ctx context.Context,
	tx *gorm.DB,
	userId uuid.UUID,
	limit *int32,
	after *time.Time,
) ([]*models.Order, *time.Time, error) {
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

	var orders []*models.Order
	for rows.Next() {
		var o models.Order
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

func (r *orderRepository) GetOrderByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	order, err := gorm.G[models.Order](tx).Where("id = ?", 1).First(ctx)

	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	return &order, nil
}

func (r *orderRepository) GetOrderDetailByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.OrderDetail, error) {
	var orderDetail models.OrderDetail
	orderDetail, err := gorm.G[models.OrderDetail](tx).Where("id = ?", 1).First(ctx)

	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	return &orderDetail, nil
}

// // todo
// func (r *orderRepository) GetOrderByIDPaginated(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error) {
// 	query := fmt.Sprintf(`
// 		SELECT id, user_id created_at, updated_at
// 		FROM %s WHERE id = $1`, orderTableName)

// 	var order Order
// 	err := r.queryRow(ctx, tx, query, id).Scan(
// 		&order.ID, &order.UserID,
// 		&order.CreatedAt, &order.UpdatedAt,
// 	)
// 	if err != nil {
// 		return nil, fmt.Errorf("order not found: %w", err)
// 	}

// 	return &order, nil
// }

func (r *orderRepository) UpdateOrderStatus(ctx context.Context, tx *gorm.DB, orderDetailId uuid.UUID, newStatus model.OrderDetailStatus) (int, error) {
	rows, err := gorm.G[models.OrderDetail](tx).Where("id = ?", orderDetailId).Update(ctx, "Status", newStatus.String())

	if err != nil {
		return 0, fmt.Errorf("failed to update order: %w", err)
	}

	return rows, err
}

func (r *orderRepository) CancelOrder(ctx context.Context, tx *gorm.DB, id uuid.UUID) (int, error) {
	rowsAffected, err := gorm.G[models.OrderDetail](tx).Where("id = ?", id).Update(ctx, "Status", model.OrderDetailStatusCancelled.String())

	if err != nil {
		return 0, fmt.Errorf("failed to cancel order: %w", err)
	}

	return rowsAffected, err
}

func (r *orderRepository) UpdateOrderDetail(ctx context.Context, tx *gorm.DB, detail models.OrderDetail) (int, error) {
	rowsAffected, err := gorm.G[models.OrderDetail](tx).Where("id = ?", detail.ID).Updates(ctx, detail)

	if err != nil {
		return 0, fmt.Errorf("update failed: %v", err)
	}

	return rowsAffected, err
}

func (r *orderRepository) GetOrderDetailByOrderID(ctx context.Context, tx *gorm.DB, orderId uuid.UUID) ([]*models.OrderDetail, error) {
	var orderDetails []*models.OrderDetail

	if err := tx.WithContext(ctx).
		Where("orders_id = ?", orderId).
		Find(&orderDetails).Error; err != nil {
		return nil, fmt.Errorf("not found: %v", err)
	}

	return orderDetails, nil
}
func (r *orderRepository) GetOrderDetailByOrderIDPaginated(
	ctx context.Context,
	tx *gorm.DB,
	orderId uuid.UUID,
	limit int32,
	after time.Time,
) ([]*models.OrderDetail, time.Time, error) {
	var orderDetails []*models.OrderDetail
	query := tx.WithContext(ctx).
		Where("orders_id = ?", orderId)

	if !after.IsZero() {
		query = query.Where("created_at > ?", after)
	}

	// Fetching the order details with pagination
	if err := query.Order("created_at ASC").
		Limit(int(limit)).
		Find(&orderDetails).Error; err != nil {
		return nil, time.Time{}, err
	}

	var nextCursor time.Time
	if len(orderDetails) > 0 {
		nextCursor = orderDetails[len(orderDetails)-1].CreatedAt
	}

	return orderDetails, nextCursor, nil
}
