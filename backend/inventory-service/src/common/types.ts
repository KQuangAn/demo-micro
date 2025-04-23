import z from 'zod';

export enum EventType {
  OrderPlaced = 'order_placed',
  OrderUpdated = 'order_updated',
  OrderCancelled = 'order_cancelled',
  OrderProcessed = 'order_processed',
  InventoryCreated = 'inventory_created',
  InventoryUpdated = 'inventory_updated',
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
  detail: z.array(InventorySchema).or(z.array(OrdersSchema)),
});

export type TQueueMessage = z.infer<typeof QueueMessage>;
