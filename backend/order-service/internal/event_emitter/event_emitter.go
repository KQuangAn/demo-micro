package eventemitter

import "context"

type Event struct {
	Source       *string
	DetailType   *string
	Detail       *string
	EventBusName *string
	TraceHeader  *string
}

type EventEmitter interface {
	Emit(ctx context.Context, event *Event) error
}
