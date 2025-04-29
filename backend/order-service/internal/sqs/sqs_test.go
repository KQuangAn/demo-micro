package sqs

import (
	"context"
	"encoding/json"
	"testing"

	"orderservice/internal/models"
	"orderservice/internal/validator"
	"orderservice/pkg/enums"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock OrderService
type MockOrderService struct {
	mock.Mock
}

func (m *MockOrderService) HandleInventoryReservedEvent(ctx context.Context, orderID string, productID string, quantity int) (models.Order, error) {
	args := m.Called(ctx, orderID, productID, quantity)
	return args.Get(0).(models.Order), args.Error(1)
}

func (m *MockOrderService) CancelOrderInsufficentInventory(ctx context.Context, orderID string) (models.Order, error) {
	args := m.Called(ctx, orderID)
	return args.Get(0).(models.Order), args.Error(1)
}

func (m *MockOrderService) HandleOrderProcessingNotificationSentEvent(ctx context.Context, orderID string) (models.Order, error) {
	args := m.Called(ctx, orderID)
	return args.Get(0).(models.Order), args.Error(1)
}

func TestHandleMessage_InventoryReserved(t *testing.T) {
	mockOrderService := new(MockOrderService)
	msgValidator := validator.New()

	eventDetail := models.InventoryReservedEventDetail{
		OrderID:   "123",
		ProductID: "456",
		Quantity:  3,
	}

	event := models.EventBridgeMessage{
		DetailType: enums.EVENT_TYPE.InventoryReserved.String(),
		Detail:     eventDetail,
	}

	message := types.Message{
		Body: aws.String(`{"DetailType":"InventoryReserved","Detail":` + string(mustJSONMarshal(eventDetail)) + `}`),
	}

	mockOrderService.On("HandleInventoryReservedEvent", mock.Anything, "123", "456", 3).Return(models.Order{ID: "123"}, nil)

	err := handleMessage(&message, msgValidator, mockOrderService)

	assert.NoError(t, err)
	mockOrderService.AssertExpectations(t)
}

func TestHandleMessage_CancelOrderInsufficientInventory(t *testing.T) {
	mockOrderService := new(MockOrderService)
	msgValidator := validator.New()

	eventDetail := models.InventoryReservedFailEventDetail{
		OrderID: "123",
	}

	event := models.EventBridgeMessage{
		DetailType: enums.EVENT_TYPE.InventoryReservationFailed.String(),
		Detail:     eventDetail,
	}

	message := types.Message{
		Body: aws.String(`{"DetailType":"InventoryReservationFailed","Detail":` + string(mustJSONMarshal(eventDetail)) + `}`),
	}

	mockOrderService.On("CancelOrderInsufficentInventory", mock.Anything, "123").Return(models.Order{ID: "123"}, nil)

	err := handleMessage(&message, msgValidator, mockOrderService)

	assert.NoError(t, err)
	mockOrderService.AssertExpectations(t)
}

func mustJSONMarshal(v interface{}) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return data
}
