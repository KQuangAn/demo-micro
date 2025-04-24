import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  AWS_REGION: z.string(),
  QUEUE_URL: z.string(),
  EVENT_BRIDGE_SOURCE: z.string(),
  EVENT_BUS_NAME: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_ENDPOINT: z.string(),
});

type TEnvConfig = z.infer<typeof envSchema>;

export const getEnv = (): TEnvConfig => {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AWS_REGION: process.env.AWS_REGION,
    QUEUE_URL: process.env.QUEUE_URL,
    EVENT_BRIDGE_SOURCE: process.env.EVENT_BRIDGE_SOURCE,
    EVENT_BUS_NAME: process.env.EVENT_BUS_NAME,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ENDPOINT: process.env.AWS_ENDPOINT,
  };
  const parsedEnv = envSchema.safeParse(env);

  if (!parsedEnv.success) {
    throw new Error(
      `Missing or invalid environment variables: ${parsedEnv.error}`,
    );
  }

  return parsedEnv.data;
};
