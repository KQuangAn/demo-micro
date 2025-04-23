import { z } from 'zod';

export const CreateOrderInputSchema = z.object({
  productId: z.string().uuid('Invalid Product ID format'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});
export type TCreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const UpdateOrderInputSchema = z.object({
  id: z.string().uuid('Invalid Order ID format'),
  productId: z.string().uuid('Invalid Product ID format'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
});
export type TUpdateOrderInput = z.infer<typeof UpdateOrderInputSchema>;

export const CancelOrderInputSchema = z.object({
  id: z.string().uuid('Invalid Order ID format'),
});
export type TCancelOrderInput = z.infer<typeof CancelOrderInputSchema>;
