import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  EVENT_BRIDGE_REGION: z.string().default('us-east-1'),
  AWS_REGION: z.string(),
  QUEUE_URL: z.string(),
  EVENT_BRIDGE_SOURCE: z.string(),
  EVENT_BUS_NAME: z.string(),
});

type TEnvConfig = z.infer<typeof envSchema>;

export const getEnv = (): TEnvConfig => {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    EVENT_BRIDGE_REGION: process.env.EVENT_BRIDGE_REGION,
    AWS_REGION: process.env.AWS_REGION,
    QUEUE_URL: process.env.QUEUE_URL,
    EVENT_BRIDGE_SOURCE: process.env.EVENT_BRIDGE_SOURCE,
    EVENT_BUS_NAME: process.env.EVENT_BUS_NAME,
  };

  const parsedEnv = envSchema.safeParse(env);

  if (!parsedEnv.success) {
    throw new Error(
      `Missing or invalid environment variables: ${parsedEnv.error}`,
    );
  }

  return parsedEnv.data;
};
