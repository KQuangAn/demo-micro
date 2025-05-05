import { z } from 'zod';

export const InventorySchema = z.object({
  id: z.string(),
  title: z.string(),
  brand: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  categories: z.array(z.string()),
  quantity: z.number().int(),
  discount: z.number(),
  price: z.number(),
  createdAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format for createdAt',
  }),
  updatedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format for updatedAt',
  }),
});

export type TInventory = z.infer<typeof InventorySchema>;
