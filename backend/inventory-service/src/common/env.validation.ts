import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('9000').transform(Number),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database
  DATABASE_URL: z.string(),

  // AWS
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  QUEUE_URL: z.string(),
  EVENT_BRIDGE_SOURCE: z.string(),
  EVENT_BUS_NAME: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;
