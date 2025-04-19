package eventbridge

// import (
// 	"context"
// 	"testing"

// 	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
// 	"github.com/stretchr/testify/assert"
// )

// type MockEventBridgeClient struct{}

// func (m *MockEventBridgeClient) PutEvents(ctx context.Context, params *eventbridge.PutEventsInput, opts ...func(*eventbridge.Options)) (*eventbridge.PutEventsOutput, error) {
// 	return &eventbridge.PutEventsOutput{
// 		FailedEntryCount: 0,
// 	}, nil
// }

// var mockClient EventBridgeClient = &MockEventBridgeClient{}

// func TestSendEventToNotificationService(t *testing.T) {
// 	notificationEvent := NotificationEvent{
// 		OrderID: "order123",
// 		Status:  "Completed",
// 	}

// 	err := SendEventToNotificationService(notificationEvent)

// 	assert.Nil(t, err, "Expected no error, but got: %v", err)
// }
