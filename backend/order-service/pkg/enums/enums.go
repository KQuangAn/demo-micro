package enums

// OrderStatus defines the status of an order.
type OrderStatus int

const (
	Pending    OrderStatus = iota // 0
	Processing                    // 1
	Completed                     // 2
	Cancelled                     // 3
)

func (os OrderStatus) String() string {
	return [...]string{"Pending", "Processing", "Completed", "Cancelled"}[os]
}

// OrderEventType defines the type of events for an order.
type OrderEventType int

const (
	OrderPlaced OrderEventType = iota
	OrderUpdated
	OrderCancelled
	OrderCompleted
	InventoryReserved
	InventoryReservationFailed
	NotificationSentSuccess
	NotificationSentFailed
)

func (oet OrderEventType) String() string {
	return [...]string{
		"order_placed",
		"order_updated",
		"order_cancelled",
		"order_completed",
		"inventory_reserved",
		"inventory_reservation_failed",
		"notification_sent_success",
		"notification_sent_failed",
	}[oet]
}

// Grouping event types
type EventType struct {
	OrderPlaced                OrderEventType
	OrderUpdated               OrderEventType
	OrderCancelled             OrderEventType
	OrderCompleted             OrderEventType
	InventoryReserved          OrderEventType
	InventoryReservationFailed OrderEventType
	NotificationSentSuccess    OrderEventType
	NotificationSentFailed     OrderEventType
}

// Initialize the EventType structure
var EVENT_TYPE = EventType{
	OrderPlaced:                OrderPlaced,
	OrderUpdated:               OrderUpdated,
	OrderCancelled:             OrderCancelled,
	OrderCompleted:             OrderCompleted,
	InventoryReserved:          InventoryReserved,
	InventoryReservationFailed: InventoryReservationFailed,
	NotificationSentSuccess:    NotificationSentSuccess,
	NotificationSentFailed:     NotificationSentFailed,
}
