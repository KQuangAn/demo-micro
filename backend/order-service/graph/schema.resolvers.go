package graph

// This file will be automatically regenerated based on the schema, any resolver implementations
// will be copied through when generating and any unknown code will be moved to the end.
// Code generated by github.com/99designs/gqlgen version v0.17.72

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"orderservice/graph/model"
	"orderservice/internal/eventbridge"
	"orderservice/internal/models"
	"orderservice/internal/sqs"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	ebTypes "github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

// CreateOrder is the resolver for the createOrder field.
func (r *mutationResolver) CreateOrder(ctx context.Context, productID string, quantity int32) (*model.Order, error) {
	orderID := fmt.Sprintf("%d", time.Now().UnixNano())

	order := model.Order{
		ID:        orderID,
		ProductID: productID,
		Quantity:  quantity,
		Status:    "Pending",
	}

	_, err := r.DB.Exec(ctx, `INSERT INTO orders (id, product_id, quantity, status, created_at) VALUES ($1, $2, $3, $4, $5)`,
		order.ID, order.ProductID, order.Quantity, order.Status)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %v", err)
	}

	// 3. Push the order creation event to SQS
	event := models.Order{
		ID:        order.ID,
		ProductID: order.ProductID,
		Quantity:  order.Quantity,
		Status:    order.Status,
	}
	err = sqs.SendEventToQueue("orderCreatedQueue", event) // `SendEventToQueue` is a helper function for SQS
	if err != nil {
		return nil, fmt.Errorf("failed to send order event to SQS: %v", err)
	}

	// 4. Process the event asynchronously from SQS (handled by a separate worker)

	// 5. Once the order is processed, send notification via EventBridge
	notification := models.Notification{
		ID:        "1",
		Event:     "",
		CreatedAt: order.Status,
	}

	eventDetail, err := json.Marshal(notification) // Assuming ev.Detail is already a struct or map
	if err != nil {
		log.Fatalf("failed to marshal event detail: %v", err)
	}

	notificationEvent := ebTypes.PutEventsRequestEntry{
		Source:       aws.String("qwefqef"),
		DetailType:   aws.String("323423"),
		Detail:       aws.String(string(eventDetail)),
		EventBusName: aws.String("qwefqef"),
	}

	err = eventbridge.SendEvent(notificationEvent)
	if err != nil {
		return nil, fmt.Errorf("failed to send notification event to EventBridge: %v", err)
	}

	// Return the created order as the mutation result
	return &order, nil
}

// Orders is the resolver for the orders field.
func (r *queryResolver) Orders(ctx context.Context) ([]*model.Order, error) {
	rows, err := r.DB.Query(ctx, "SELECT id, product_id, quantity, status FROM orders")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*model.Order
	for rows.Next() {
		var o model.Order
		if err := rows.Scan(&o.ID, &o.ProductID, &o.Quantity, &o.Status); err != nil {
			return nil, err
		}
		orders = append(orders, &o)
	}
	return orders, nil
}

// Order is the resolver for the order field.
func (r *queryResolver) Order(ctx context.Context, id string) (*model.Order, error) {
	panic(fmt.Errorf("not implemented: Order - order"))
}

// Mutation returns MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }

// !!! WARNING !!!
// The code below was going to be deleted when updating resolvers. It has been copied here so you have
// one last chance to move it out of harms way if you want. There are two reasons this happens:
//  - When renaming or deleting a resolver the old code will be put in here. You can safely delete
//    it when you're done.
//  - You have helper methods in this file. Move them out to keep these resolver files clean.
/*
	func (r *mutationResolver) CreateTodo(ctx context.Context, input model.NewTodo) (*model.Todo, error) {
	panic(fmt.Errorf("not implemented: CreateTodo - createTodo"))
}
func (r *queryResolver) Todos(ctx context.Context) ([]*model.Todo, error) {
	panic(fmt.Errorf("not implemented: Todos - todos"))
}
*/
