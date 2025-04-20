import { z } from 'zod';

export const CreateInventoryInputSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    quantity: z.number().int().min(0, "Quantity must be a non-negative integer"),
    price: z.number().positive("Price must be a positive number"),
});
export type TCreateInventoryInput = z.infer<typeof CreateInventoryInputSchema>;

export const UpdateInventoryInputSchema = z.object({
    id: z.string().uuid("Invalid ID format"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    quantity: z.number().int().min(0, "Quantity must be a non-negative integer"),
    price: z.number().positive("Price must be a positive number"),
});
export type TUpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;

export const RemoveInventoryInputSchema = z.object({
    id: z.string().uuid("Invalid ID format"),
});
export type TRemoveInventoryInput = z.infer<typeof RemoveInventoryInputSchema>;