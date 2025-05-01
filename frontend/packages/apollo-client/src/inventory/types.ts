import { z } from 'zod';

export const CreateInventoryInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  images: z.array(z.string().url('Image URLs must be valid')),
  categories: z.array(
    z.object({ title: z.string().min(1, 'Category title is required') })
  ),
  quantity: z.number().int().min(0, 'Quantity must be a non-negative integer'),
  price: z.number().positive('Price must be a positive number'),
  discount: z.number().nonnegative('Discount must be non-negative').optional(),
});
export type TCreateInventoryInput = z.infer<typeof CreateInventoryInputSchema>;

export const UpdateInventoryInputSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
  title: z.string().min(1, 'Title is required'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  images: z.array(z.string().url('Image URLs must be valid')),
  categories: z.array(
    z.object({ title: z.string().min(1, 'Category title is required') })
  ),
  quantity: z.number().int().min(0, 'Quantity must be a non-negative integer'),
  price: z.number().positive('Price must be a positive number'),
  discount: z.number().nonnegative('Discount must be non-negative').optional(),
});
export type TUpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;

export const RemoveInventoryInputSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
export type TRemoveInventoryInput = z.infer<typeof RemoveInventoryInputSchema>;


export const ProductInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  currency: z.string(),
});

export const ReserveInventoryInputSchema = z.object({
  userId: z.string().uuid(),
  products: z.array(ProductInputSchema),
});


export type TProductInput = z.infer<typeof ProductInputSchema>;
export type TReserveInventoryInput = z.infer<typeof ReserveInventoryInputSchema>;