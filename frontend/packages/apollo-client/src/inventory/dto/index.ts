import { z } from 'zod';

export const ReserveInventorySchema = z.object({
  userId: z.string(),
  productId: z.string(),
  quantity: z.number().int().min(1),
});

export type TReserveInventory = z.infer<typeof ReserveInventorySchema>;
