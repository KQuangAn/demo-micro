import { z } from 'zod';
import { InventorySchema } from '@repo/apollo-client';

export const cartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid Product ID format'),
      product: InventorySchema,
      count: z.number().int().min(1, 'count must be at least 1'),
    })
  ),
});
export type TCart = z.infer<typeof cartSchema>;
