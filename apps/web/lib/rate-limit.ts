import { redis } from './redis';
import crypto from 'crypto';

const RATE_LIMIT_SCRIPT = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  failPolicy: 'open' | 'closed' = 'open'
): Promise<{ success: boolean; current: number }> {
  try {
    const current = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, windowSeconds) as number;
    return {
      success: current <= limit,
      current,
    };
  } catch (error) {
    console.warn('[RateLimit] Redis rate limiting failed. Fail policy:', failPolicy, error);
    
    if (failPolicy === 'closed') {
      // In fail-closed, we deny the request if Redis is down
      return { success: false, current: 0 };
    }
    
    // Fail open allows the request if Redis is down
    return { success: true, current: 0 };
  }
}

export async function rateLimitLogin(
  ip: string,
  email: string,
  failPolicy: 'open' | 'closed' = 'closed'
): Promise<{ success: boolean }> {
  try {
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
    const ipKey = `rate-limit:auth:login:ip:${ip}`;
    const emailKey = `rate-limit:auth:login:email:${emailHash}`;

    const [ipCurrent, emailCurrent] = await Promise.all([
      redis.eval(RATE_LIMIT_SCRIPT, 1, ipKey, 300) as Promise<number>,
      redis.eval(RATE_LIMIT_SCRIPT, 1, emailKey, 300) as Promise<number>
    ]);

    if (ipCurrent > 50 || emailCurrent > 10) {
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.warn('[RateLimit] Redis rate limiting failed. Fail policy:', failPolicy, error);
    if (failPolicy === 'closed') {
      return { success: false };
    }
    return { success: true };
  }
}
