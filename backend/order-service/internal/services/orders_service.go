package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"orderservice/graph/model"
	eventemitter "orderservice/internal/event_emitter"
	"orderservice/internal/repository"
	"orderservice/internal/utils"
	"orderservice/pkg/enums"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderService interface {
	runTransaction(ctx context.Context, fn func(tx *gorm.DB) (any, error)) (any, error)

	CreateOrder(ctx context.Context, userId uuid.UUID, items []OrderItemInput) (*model.Order, error)
	GetAllOrders(ctx context.Context, first *int32, after *time.Time) (*model.OrderConnection, error)
	GetOrderByID(ctx context.Context, id uuid.UUID) (*model.Order, error)
	GetOrdersByUserId(ctx context.Context, userID uuid.UUID, first *int32, after *time.Time) (*model.OrderConnection, error)
	CancelOrder(ctx context.Context, orderId uuid.UUID) (*model.Order, error)

	GetAllOrdersDetail(ctx context.Context, first *int32, after *time.Time) (*model.OrderDetailConnection, error)
	GetOrdersDetailByOrderId(ctx context.Context, orderId uuid.UUID, first *int32, after *time.Time) (*model.OrderDetailConnection, error)
	UpdateOrderDetail(ctx context.Context, orderDetailID uuid.UUID, quantity *int32, status *model.OrderDetailStatus) (*model.OrderDetail, error)

	HandleInventoryReservedEvent(
		ctx context.Context,
		userID uuid.UUID,
		items []OrderItemInput,
	) (*model.Order, error)
	HandleOrderProcessingNotificationSentEvent(ctx context.Context, id uuid.UUID) (*model.Order, error)
}

type OrderItemInput struct {
	ProductID string
	Quantity  int32
	Price     float64
	Currency  string
}

func (o *OrderItemInput) ToModelOrderItemInput() *repository.OrderItemInput {
	return &repository.OrderItemInput{
		ProductID: o.ProductID,
		Quantity:  o.Quantity,
		Price:     o.Price,
		Currency:  o.Currency,
	}
}

func ToModelOrderItemInputs(items []OrderItemInput) []*repository.OrderItemInput {
	var result []*repository.OrderItemInput
	for _, item := range items {
		result = append(result, &repository.OrderItemInput{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			Price:     item.Price,
			Currency:  item.Currency,
		})
	}
	return result
}

type orderService struct {
	orderRepo    repository.OrderRepository
	eventEmitter eventemitter.EventEmitter
	db           *gorm.DB
}

func NewOrderService(orderRepo repository.OrderRepository, eventEmitter eventemitter.EventEmitter, db *gorm.DB) OrderService {
	return &orderService{
		orderRepo:    orderRepo,
		eventEmitter: eventEmitter,
		db:           db,
	}
}

func (s *orderService) runTransaction(ctx context.Context, fn func(tx *gorm.DB) (any, error)) (any, error) {
	var result any
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = fn(tx)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("transaction failed: %w", err)
	}

	return result, nil
}

func (s *orderService) GetAllOrders(ctx context.Context, first *int32, after *time.Time) (*model.OrderConnection, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		res, _, err := s.orderRepo.GetAllOrders(ctx, tx, first, after)
		if err != nil {
			return nil, fmt.Errorf("error querying db, %v", err)
		}
		var modelOrders []*model.Order
		for _, order := range res {
			if order != nil {
				modelOrders = append(modelOrders, order.ToModelOrder())
			}
		}

		return modelOrders, nil
	})

	if err != nil {
		return nil, err
	}

	orders, ok := result.([]*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	if len(orders) == 0 {
		return &model.OrderConnection{
			Edges:    []*model.OrderEdge{},
			PageInfo: &model.PageInfo{HasNextPage: false, HasPreviousPage: false},
		}, nil
	}

	var edges []*model.OrderEdge
	for _, order := range orders {
		edges = append(edges, &model.OrderEdge{
			Node:   order,
			Cursor: order.CreatedAt,
		})
	}

	pageInfo := &model.PageInfo{
		HasNextPage:     len(orders) >= int(*first),
		HasPreviousPage: *first > 0,
		StartCursor:     &orders[0].CreatedAt,
		EndCursor:       &orders[len(orders)-1].CreatedAt,
	}

	return &model.OrderConnection{
		Edges:    edges,
		PageInfo: pageInfo,
	}, nil
}

func (s *orderService) GetOrderByID(ctx context.Context, id uuid.UUID) (*model.Order, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		res, err := s.orderRepo.GetOrderByID(ctx, tx, id)
		if err != nil {
			return nil, fmt.Errorf("error querying db, %v", err)
		}

		return res.ToModelOrder(), nil
	})

	if err != nil {
		return nil, err
	}

	order, ok := result.(*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return order, nil
}

func (s *orderService) GetOrdersByUserId(
	ctx context.Context,
	userId uuid.UUID,
	first *int32,
	after *time.Time,
) (*model.OrderConnection, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		orders, nextCursor, err := s.orderRepo.GetOrdersByUserId(ctx, tx, userId, first, after)

		if err != nil {
			return nil, fmt.Errorf("error querying db, %v", err)
		}
		edges := make([]*model.OrderEdge, len(orders))
		for i, order := range orders {
			edges[i] = &model.OrderEdge{
				Node:   order.ToModelOrder(),
				Cursor: order.CreatedAt,
			}
		}

		var startCursor, endCursor *time.Time
		if len(edges) > 0 {
			start := edges[0].Cursor
			end := nextCursor
			startCursor = &start
			endCursor = end
		}

		hasNextPage := len(orders) == int(*first)

		return &model.OrderConnection{
			Edges: edges,
			PageInfo: &model.PageInfo{
				HasNextPage:     hasNextPage,
				HasPreviousPage: after != nil,
				StartCursor:     startCursor,
				EndCursor:       endCursor,
			},
		}, nil
	})

	if err != nil {
		return nil, err
	}

	orderConnection, ok := result.(*model.OrderConnection)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return orderConnection, nil
}

func (s *orderService) CreateOrder(
	ctx context.Context,
	userId uuid.UUID,
	items []OrderItemInput,
) (*model.Order, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		transformedItems := ToModelOrderItemInputs(items)
		createdOrder, err := s.orderRepo.CreateOrder(ctx, tx, userId, transformedItems)

		if err != nil {
			return nil, fmt.Errorf("failed to insert order: %v", err)
		}

		order := createdOrder.ToModelOrder()

		if err := s.emitEvent(ctx, order, enums.OrderPlaced); err != nil {
			return nil, fmt.Errorf("failed to emit order event: %v", err)
		}

		return order, nil
	})
	if err != nil {
		//err := s.emitEvent(ctx, "failed to create order", enums.OrderPlacedFail)
		return nil, err
	}

	order, ok := result.(*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return order, nil
}

func (s *orderService) GetAllOrdersDetail(
	ctx context.Context,
	first *int32,
	after *time.Time,
) (*model.OrderDetailConnection, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		baseQuery := `
			SELECT
				od.id,
				od.orders_id,
				od.product_id,
				c.name as currency_name,
				od.quantity,
				od.price,
				od.status,
				od.created_at,
				od.updated_at
			FROM order_details od
			JOIN currencies c ON od.currency_id = c.id
		`
		query, params := utils.BuildPaginationQuery(baseQuery, after, first, "od.created_at", 1)

		rows, err := tx.Query(ctx, query, params...)
		if err != nil {
			return nil, fmt.Errorf("failed to execute query: %v", err)
		}
		defer rows.Close()

		var edges []*model.OrderDetailEdge
		var startCursor, endCursor *time.Time

		for rows.Next() {
			var detail model.OrderDetail

			if err := rows.Scan(
				&detail.ID,
				&detail.OrderID,
				&detail.ProductID,
				&detail.Currency,
				&detail.Quantity,
				&detail.Price,
				&detail.Status,
				&detail.CreatedAt,
				&detail.UpdatedAt,
			); err != nil {
				return nil, fmt.Errorf("failed to scan row: %v", err)
			}

			cursor := detail.CreatedAt // assuming createdAt is sortable and used as cursor
			edges = append(edges, &model.OrderDetailEdge{
				Node:   &detail,
				Cursor: cursor,
			})
		}

		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("rows iteration error: %v", err)
		}

		if len(edges) > 0 {
			startCursor = &edges[0].Cursor
			endCursor = &edges[len(edges)-1].Cursor
		}

		hasNextPage := len(edges) > 0 && (first != nil && int32(len(edges)) == *first)

		connection := &model.OrderDetailConnection{
			Edges: edges,
			PageInfo: &model.PageInfo{
				StartCursor:     startCursor,
				EndCursor:       endCursor,
				HasNextPage:     hasNextPage,
				HasPreviousPage: after != nil,
			},
		}

		return connection, nil
	})

	if err != nil {
		return nil, err
	}

	conn, ok := result.(*model.OrderDetailConnection)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return conn, nil
}

func (s *orderService) GetOrdersDetailByOrderId(
	ctx context.Context,
	orderID uuid.UUID,
	first *int32,
	after *time.Time,
) (*model.OrderDetailConnection, error) {

	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {

		baseQuery := `
		SELECT
			od.id,
			od.orders_id,
			od.product_id,
			od.quantity,
			od.price,
			c.name as currency_name,
			od.status,
			od.created_at,
			od.updated_at
		FROM order_details od
		JOIN currencies c ON od.currency_id = c.id
		WHERE od.orders_id = $1
	`

		query, params := utils.BuildPaginationQuery(baseQuery, after, first, "od.created_at", 2)

		params = append([]any{orderID}, params...)

		rows, err := tx.Query(ctx, query, params...)
		if err != nil {
			return nil, fmt.Errorf("query error: %w", err)
		}
		defer rows.Close()
		var orderDetails []*model.OrderDetail

		for rows.Next() {
			var orderDetail model.OrderDetail

			if err := rows.Scan(
				&orderDetail.ID,
				&orderDetail.OrderID,
				&orderDetail.ProductID,
				&orderDetail.Quantity,
				&orderDetail.Price,
				&orderDetail.Currency,
				&orderDetail.Status,
				&orderDetail.CreatedAt,
				&orderDetail.UpdatedAt,
			); err != nil {
				return nil, fmt.Errorf("failed to scan row: %v", err)
			}

			orderDetails = append(orderDetails, &orderDetail)
		}

		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("rows iteration error: %v", err)
		}

		return orderDetails, nil
	})
	if err != nil {
		return nil, err
	}

	orderDetails, ok := result.([]*model.OrderDetail)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	if len(orderDetails) == 0 {
		return &model.OrderDetailConnection{
			Edges:    []*model.OrderDetailEdge{},
			PageInfo: &model.PageInfo{},
		}, nil
	}
	var hasNextPage bool
	var hasPreviousPage bool

	if first != nil {
		hasNextPage = len(orderDetails) > int(*first)
		hasPreviousPage = *first > 0
	} else {
		hasNextPage = false
		hasPreviousPage = false
	}

	pageInfo := &model.PageInfo{
		HasNextPage:     hasNextPage,
		HasPreviousPage: hasPreviousPage,
		StartCursor:     &orderDetails[0].CreatedAt,
		EndCursor:       &orderDetails[len(orderDetails)-1].CreatedAt,
	}

	// Create an array of pointers to OrderDetailEdge
	var edges []*model.OrderDetailEdge
	for _, orderDetail := range orderDetails {
		edges = append(edges, &model.OrderDetailEdge{
			Node:   orderDetail,
			Cursor: orderDetail.CreatedAt,
		})
	}

	return &model.OrderDetailConnection{
		Edges:    edges,
		PageInfo: pageInfo,
	}, nil
}

func (s *orderService) UpdateOrderDetail(ctx context.Context, orderDetailID uuid.UUID, quantity *int32, status *model.OrderDetailStatus) (*model.OrderDetail, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		var newOrderDetail repository.OrderDetail
		newOrderDetail.ID = orderDetailID
		newOrderDetail.Quantity = int(*quantity)
		newOrderDetail.Status = status.String()

		orderDetail, err := s.orderRepo.UpdateOrderDetail(ctx, tx, newOrderDetail)
		if err != nil {
			return nil, fmt.Errorf("error updating order detail: %v", err)
		}
		return orderDetail, nil
	})

	if err != nil {
		return nil, err
	}

	orderDetail, ok := result.(*model.OrderDetail)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return orderDetail, nil
}

func (s *orderService) CancelOrder(ctx context.Context, orderId uuid.UUID) (*model.Order, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		order, err := s.orderRepo.CancelOrder(ctx, tx, orderId)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch order details: %v", err)
		}
		return order, err
	})

	if err != nil {
		return nil, err
	}

	order, ok := result.(*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}

	return order, nil
}

func (s *orderService) emitEvent(ctx context.Context, detail any, detailType enums.OrderEventType) error {
	detailJSON, err := json.Marshal(detail)
	if err != nil {
		log.Fatalf("failed to marshal order detail: %v", err)
		return err
	}
	correlationID := uuid.New().String()

	event := &eventemitter.Event{
		Source:       aws.String(os.Getenv("EVENT_BRIDGE_EVENT_SOURCE")),
		DetailType:   aws.String(detailType.String()),
		Detail:       aws.String(string(detailJSON)),
		EventBusName: aws.String(os.Getenv("EVENT_BRIDGE_BUS_NAME")),
		TraceHeader:  aws.String(correlationID),
	}

	return s.eventEmitter.Emit(ctx, event)
}

func (s *orderService) HandleInventoryReservedEvent(
	ctx context.Context,
	userID uuid.UUID,
	items []OrderItemInput,
) (*model.Order, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		order, err := s.CreateOrder(ctx, userID, items)

		if err != nil {
			return nil, fmt.Errorf("failed to create order %s", err)
		}
		err = s.emitEvent(ctx, order, enums.OrderPlaced)
		if err != nil {
			return nil, fmt.Errorf("failed to emit an event %s", err)
		}

		return order, nil
	})

	order, ok := result.(*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}
	return order, err
}

func (s *orderService) HandleOrderProcessingNotificationSentEvent(ctx context.Context, orderDetailId uuid.UUID) (*model.Order, error) {
	result, err := s.runTransaction(ctx, func(tx *gorm.DB) (any, error) {
		order, err := s.orderRepo.UpdateOrderStatus(ctx, tx, orderDetailId, model.OrderDetailStatusCompleted)

		if err != nil {
			return nil, fmt.Errorf("failed to update order, %s", err)
		}
		err = s.emitEvent(ctx, order, enums.OrderUpdated)
		if err != nil {
			return nil, fmt.Errorf("failed to emit an event, %s", err)
		}

		return order, nil
	})

	order, ok := result.(*model.Order)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from transaction")
	}
	return order, err
}
