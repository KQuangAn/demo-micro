package repository

import (
	"context"
	"fmt"
	"orderservice/graph/model"
	"orderservice/internal/models"
	"strings"
	"time"

	"github.com/google/uuid"
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
	order := models.Order{
		UserID:    user_id,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := tx.WithContext(ctx).Create(&order).Error; err != nil {
		return nil, fmt.Errorf("failed to insert order: %w", err)
	}

	var currencies []*models.Currency
	if err := tx.WithContext(ctx).Find(&currencies).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch currencies: %w", err)
	}
	lookup := NewCurrencyLookup(currencies)

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
		orderDetails = append(orderDetails, &models.OrderDetail{
			OrderID:    order.ID,
			ProductID:  productUUID,
			Quantity:   int(item.Quantity),
			Price:      item.Price,
			CurrencyID: currencyId,
			Status:     string(model.OrderDetailStatusPending),
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		})
	}
	if len(orderDetails) > 0 {
		if err := tx.WithContext(ctx).Create(&orderDetails).Error; err != nil {
			return nil, fmt.Errorf("failed to insert order details: %w", err)
		}
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
	var orders []*models.Order
	query := tx.WithContext(ctx).Where("user_id = ?", userId).Order("created_at ASC")
	if after != nil {
		query = query.Where("created_at > ?", *after)
	}
	if first != nil {
		query = query.Limit(int(*first))
	} else {
		query = query.Limit(10)
	}
	if err := query.Find(&orders).Error; err != nil {
		return nil, nil, fmt.Errorf("query failed: %w", err)
	}
	var next *time.Time
	if len(orders) > 0 {
		next = &orders[len(orders)-1].CreatedAt
	}
	return orders, next, nil
}

func (r *orderRepository) GetAllOrders(
	ctx context.Context,
	tx *gorm.DB,
	first *int32, after *time.Time,
) ([]*models.Order, *time.Time, error) {
	var orders []*models.Order
	query := tx.WithContext(ctx).Order("created_at ASC")
	if after != nil {
		query = query.Where("created_at > ?", *after)
	}
	if first != nil {
		query = query.Limit(int(*first))
	} else {
		query = query.Limit(10)
	}
	if err := query.Find(&orders).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to execute query: %v", err)
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
	var orders []*models.Order
	query := tx.WithContext(ctx).Where("user_id = ?", userId).Order("created_at ASC")
	if after != nil && !after.IsZero() {
		query = query.Where("created_at > ?", *after)
	}
	if limit != nil {
		query = query.Limit(int(*limit))
	}
	if err := query.Find(&orders).Error; err != nil {
		return nil, nil, fmt.Errorf("query failed: %w", err)
	}
	var nextCursor *time.Time
	if len(orders) > 0 {
		nextCursor = &orders[len(orders)-1].CreatedAt
	}
	return orders, nextCursor, nil
}

func (r *orderRepository) GetOrderByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	if err := tx.WithContext(ctx).Where("id = ?", id).First(&order).Error; err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) GetOrderDetailByID(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.OrderDetail, error) {
	var orderDetail models.OrderDetail
	if err := tx.WithContext(ctx).Where("id = ?", id).First(&orderDetail).Error; err != nil {
		return nil, fmt.Errorf("order detail not found: %w", err)
	}
	return &orderDetail, nil
}

func (r *orderRepository) UpdateOrderStatus(ctx context.Context, tx *gorm.DB, orderDetailId uuid.UUID, newStatus model.OrderDetailStatus) (*models.OrderDetail, error) {
	var detail models.OrderDetail
	if err := tx.WithContext(ctx).Model(&models.OrderDetail{}).
		Where("id = ?", orderDetailId).
		Update("status", newStatus.String()).Error; err != nil {
		return nil, fmt.Errorf("failed to update order: %w", err)
	}
	if err := tx.WithContext(ctx).Where("id = ?", orderDetailId).First(&detail).Error; err != nil {
		return nil, fmt.Errorf("order detail not found after update: %w", err)
	}
	return &detail, nil
}

func (r *orderRepository) CancelOrder(ctx context.Context, tx *gorm.DB, id uuid.UUID) (*models.Order, error) {
	if err := tx.WithContext(ctx).Model(&models.OrderDetail{}).
		Where("id = ?", id).
		Update("status", model.OrderDetailStatusCancelled.String()).Error; err != nil {
		return nil, fmt.Errorf("failed to cancel order: %w", err)
	}
	var order models.Order
	if err := tx.WithContext(ctx).Where("id = ?", id).First(&order).Error; err != nil {
		return nil, fmt.Errorf("order not found after cancel: %w", err)
	}
	return &order, nil
}

func (r *orderRepository) UpdateOrderDetail(ctx context.Context, tx *gorm.DB, detail models.OrderDetail) (*models.OrderDetail, error) {
	if err := tx.WithContext(ctx).Model(&models.OrderDetail{}).
		Where("id = ?", detail.ID).
		Updates(detail).Error; err != nil {
		return nil, fmt.Errorf("update failed: %v", err)
	}
	var updated models.OrderDetail
	if err := tx.WithContext(ctx).Where("id = ?", detail.ID).First(&updated).Error; err != nil {
		return nil, fmt.Errorf("order detail not found after update: %w", err)
	}
	return &updated, nil
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
	query := tx.WithContext(ctx).Where("orders_id = ?", orderId)
	if !after.IsZero() {
		query = query.Where("created_at > ?", after)
	}
	if limit > 0 {
		query = query.Limit(int(limit))
	}
	if err := query.Order("created_at ASC").Find(&orderDetails).Error; err != nil {
		return nil, time.Time{}, err
	}
	var nextCursor time.Time
	if len(orderDetails) > 0 {
		nextCursor = orderDetails[len(orderDetails)-1].CreatedAt
	}
	return orderDetails, nextCursor, nil
}
