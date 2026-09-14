import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisService } from '../redis/redis.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: jest.Mocked<Reflector>;
  let redisService: jest.Mocked<RedisService>;
  let redisClient: any;

  beforeEach(() => {
    reflector = { get: jest.fn() } as any;
    
    redisClient = {
      eval: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    } as any;

    guard = new RateLimitGuard(reflector, redisService);
  });

  it('should allow request if no metadata is set', async () => {
    reflector.get.mockReturnValue(null);
    const context = { getHandler: jest.fn() } as any;
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow request if within limits', async () => {
    reflector.get.mockReturnValue({
      keyPrefix: 'test:',
      limit: 5,
      windowSeconds: 60,
      extractKey: 'ip',
    });

    const request = {
      ip: '127.0.0.1',
      headers: {},
      socket: {},
      body: { email: 'test@example.com' }
    };

    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as any;

    redisClient.eval.mockResolvedValue(1);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(redisClient.eval).toHaveBeenCalledWith(expect.any(String), 1, 'test:127.0.0.1:email:test@example.com', 60);
  });

  it('should throw 429 if limit exceeded', async () => {
    reflector.get.mockReturnValue({
      keyPrefix: 'test:',
      limit: 5,
      windowSeconds: 60,
      extractKey: 'ip',
    });

    const request = {
      ip: '127.0.0.1',
      headers: {},
      body: {}
    };

    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as any;

    redisClient.eval.mockResolvedValue(6);

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should fail open if Redis throws and policy is open', async () => {
    reflector.get.mockReturnValue({
      keyPrefix: 'test:',
      limit: 5,
      windowSeconds: 60,
      extractKey: 'ip',
      failPolicy: 'open'
    });

    const request = {
      ip: '127.0.0.1',
      headers: {},
      body: {}
    };

    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as any;

    redisClient.eval.mockRejectedValue(new Error('Redis is down'));

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should fail closed if Redis throws and policy is closed', async () => {
    reflector.get.mockReturnValue({
      keyPrefix: 'test:',
      limit: 5,
      windowSeconds: 60,
      extractKey: 'ip',
      failPolicy: 'closed'
    });

    const request = {
      ip: '127.0.0.1',
      headers: {},
      body: {}
    };

    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as any;

    redisClient.eval.mockRejectedValue(new Error('Redis is down'));

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should use userId if extractKey is userId', async () => {
    reflector.get.mockReturnValue({
      keyPrefix: 'test:',
      limit: 5,
      windowSeconds: 60,
      extractKey: 'userId',
    });

    const request = {
      user: { id: 'user-123' },
      headers: {},
      body: {}
    };

    const context = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as any;

    redisClient.eval.mockResolvedValue(1);

    await guard.canActivate(context);
    expect(redisClient.eval).toHaveBeenCalledWith(expect.any(String), 1, 'test:user-123', 60);
  });
});
