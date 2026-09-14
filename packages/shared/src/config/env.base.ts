import { z } from 'zod';

const noLocalhostInProd = (val: string | undefined) => {
  if (process.env.NODE_ENV === 'production' && val) {
    return !(val.includes('localhost') || val.includes('127.0.0.1') || val.includes('[::1]'));
  }
  return true;
};

const productionRequired = (val: string | undefined) => {
  if (process.env.NODE_ENV === 'production') {
    return val !== undefined && val.trim() !== '';
  }
  return true;
};

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().optional()
    .refine(productionRequired, 'DATABASE_URL is required in production')
    .refine(noLocalhostInProd, 'Production DATABASE_URL cannot be localhost'),
  REDIS_URL: z.string().optional()
    .refine(noLocalhostInProd, 'Production REDIS_URL cannot be localhost'),
  RABBITMQ_URL: z.string().optional()
    .refine(noLocalhostInProd, 'Production RABBITMQ_URL cannot be localhost'),
  JWT_SECRET: z.string().optional(),
});
