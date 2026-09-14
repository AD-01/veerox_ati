import { Redis } from '@veerox/shared/src/redis/redis.module';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Prevent multiple connections in development
const globalForRedis = global as unknown as { redis: typeof Redis.prototype };

export const redis = globalForRedis.redis || new Redis(redisUrl);

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
