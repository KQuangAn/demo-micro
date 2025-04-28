import z from 'zod';

export enum EventType {
  OrderPlaced = 'order_placed',
  OrderUpdated = 'order_updated',
  OrderCancelledByUser = 'order_cancelled_by_user',
  OrderCancelledInsufficentInventory = 'order_cancelled_insufficent_inventory',
  OrderCancelledInsufficentFunds = 'order_cancelled_insufficent_funds',
  OrderProcessed = 'order_processed',
  OrderCompleted = 'order_completed',
  InventoryCreated = 'inventory_created',
  InventoryUpdated = 'inventory_updated',
  InventoryUpdatedFailed = 'inventory_updated_failed',
  InventoryDeleted = 'inventory_delete',
  InventoryReserved = 'inventory_reserved',
  InventoryReservationFailed = 'inventory_reservation_failed',
  NotificationSentSuccess = 'notification_sent_success',
  NotificationSentFailed = 'notification_sent_failed',
}

export const InventorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number().int(),
  price: z.number(),
  updatedAt: z.string(),
});
export type TInventory = z.infer<typeof InventorySchema>;

export const OrdersSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number().int(),
  status: z.string(),
});
export type TOrders = z.infer<typeof OrdersSchema>;

export const QueueMessage = z.object({
  'detail-type': z.nativeEnum(EventType),
  detail: OrdersSchema,
});

export type TMessage = z.infer<typeof QueueMessage>;

export const SQSMessageSchema = z.object({
  Body: z.object({
    'detail-type': z.nativeEnum(EventType),
    detail: OrdersSchema,
  }),
  MD5OfBody: z.string(),
  MessageId: z.string(),
  ReceiptHandle: z.string(),
});
