package eventemitter

import (
	"context"
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	eb "github.com/aws/aws-sdk-go-v2/service/eventbridge"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockEventBridgeClient struct {
	mock.Mock
}

func (m *MockEventBridgeClient) PutEvents(ctx context.Context, params *eb.PutEventsInput, optFns ...func(*eb.Options)) (*eb.PutEventsOutput, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*eb.PutEventsOutput), args.Error(1)
}
func TestSendEvent_Success(t *testing.T) {
	mockClient := new(MockEventBridgeClient)
	client = mockClient // Use mock client in tests

	eventEntry := &types.PutEventsRequestEntry{
		Source:       aws.String("my.source"),
		DetailType:   aws.String("my.detail.type"),
		Detail:       aws.String("{\"key\":\"value\"}"),
		EventBusName: aws.String("my.event.bus"),
	}

	mockClient.On("PutEvents", mock.Anything, mock.AnythingOfType("*github.com/aws/aws-sdk-go-v2/service/eventbridge/types.PutEventsInput")).
		Return(&types.PutEventsOutput{}, nil)

	err := SendEvent(eventEntry)

	assert.NoError(t, err)
	mockClient.AssertExpectations(t)
}

func TestSendEvent_Failure(t *testing.T) {
	mockClient := new(MockEventBridgeClient)
	client = mockClient // Use mock client in tests

	eventEntry := &types.PutEventsRequestEntry{
		Source:       aws.String("my.source"),
		DetailType:   aws.String("my.detail.type"),
		Detail:       aws.String("{\"key\":\"value\"}"),
		EventBusName: aws.String("my.event.bus"),
	}

	mockClient.On("PutEvents", mock.Anything, mock.AnythingOfType("*github.com/aws/aws-sdk-go-v2/service/eventbridge/types.PutEventsInput")).
		Return(nil, errors.New("failed to send event"))

	err := SendEvent(eventEntry)

	assert.Error(t, err)
	assert.Equal(t, "failed to send event to EventBridge: failed to send event", err.Error())
	mockClient.AssertExpectations(t)
}
