import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  ipLimit?: number;
  ipWindowSeconds?: number;
  extractKey: 'ip' | 'userId' | 'login';
  failPolicy?: 'open' | 'closed';
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
