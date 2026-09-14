import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { Request } from 'express';
import * as crypto from 'crypto';

const RATE_LIMIT_SCRIPT = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    let identifier = 'unknown';

    if (options.extractKey === 'userId') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (request as any).user;
      if (user && user.id) {
        identifier = user.id;
      } else if (user && user.sub) {
        identifier = user.sub;
      }
    } else {
      // Use securely populated request.ip via Express 'trust proxy'. Fallback to socket IP or localhost.
      // Do NOT manually parse x-forwarded-for which allows client spoofing.
      identifier = request.ip || request.socket?.remoteAddress || '127.0.0.1';
      
      // If we are rate limiting an IP and there's a user email in the body, include it to allow NAT sharing
      if (options.extractKey === 'ip' && request.body && request.body.email) {
        const email = String(request.body.email).toLowerCase();
        identifier = `${identifier}:email:${email}`;
      }
    }

    const key = `${options.keyPrefix}${identifier}`;
    const redisClient = this.redisService.getClient();

    try {
      if (options.extractKey === 'login') {
        const ip = request.ip || request.socket?.remoteAddress || '127.0.0.1';
        let email = 'unknown';
        if (request.body && request.body.email) {
          email = String(request.body.email).toLowerCase().trim();
        }
        
        // Hash the email to guarantee bounded Redis key length
        const emailHash = crypto.createHash('sha256').update(email).digest('hex');
        
        const ipKey = `${options.keyPrefix}ip:${ip}`;
        const emailKey = `${options.keyPrefix}email:${emailHash}`;

        const ipLimit = options.ipLimit || 50;
        const ipWindow = options.ipWindowSeconds || options.windowSeconds;

        const [ipCurrent, emailCurrent] = await Promise.all([
          redisClient.eval(RATE_LIMIT_SCRIPT, 1, ipKey, ipWindow) as Promise<number>,
          redisClient.eval(RATE_LIMIT_SCRIPT, 1, emailKey, options.windowSeconds) as Promise<number>
        ]);

        if (ipCurrent > ipLimit || emailCurrent > options.limit) {
          this.logger.warn(`Rate limit exceeded for login. IP Current: ${ipCurrent}/${ipLimit}, Email Current: ${emailCurrent}/${options.limit}`);
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: 'Too many requests. Please try again later.',
              error: 'Too Many Requests',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        return true;
      }

      const current = await redisClient.eval(RATE_LIMIT_SCRIPT, 1, key, options.windowSeconds) as number;

      if (current > options.limit) {
        this.logger.warn(`Rate limit exceeded for key: ${key}. Current: ${current}, Limit: ${options.limit}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to execute rate limiting for key: ${key}`, error);
      
      const failPolicy = options.failPolicy || 'open';
      if (failPolicy === 'closed') {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Authentication service temporarily unavailable. Please try again later.',
            error: 'Service Unavailable',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      // Fail open if Redis is down and policy is open
      return true;
    }
  }
}
