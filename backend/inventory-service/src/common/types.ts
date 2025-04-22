import z from 'zod';

export enum EventType {
  OrdersCreated = 'orders.created',
  OrdersUpdate = 'orders.updated',
  OrdersCancelled = 'orders.cancelled',
  InventoryCreated = 'inventory.created',
  InventoryUpdated = 'inventory.updated',
  InventoryDeleted = 'inventory.deleted',
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
