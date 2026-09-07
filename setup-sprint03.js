const fs = require('fs');
const path = require('path');

function write(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content.trim() + '\n', 'utf8');
}

// 1. Database Package
write('packages/database/package.json', JSON.stringify({
  "name": "@veerox/database",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\"",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "@veerox/config": "workspace:*"
  }
}, null, 2));

write('packages/database/tsconfig.json', JSON.stringify({
  "extends": "@veerox/config/tsconfig.nest.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}, null, 2));

write('packages/database/jest.config.js', "module.exports = require('@veerox/config/jest.config.js');");
write('packages/database/.eslintrc.json', JSON.stringify({"extends": "../../packages/config/eslint-node.json"}, null, 2));

write('packages/database/prisma/schema.prisma', `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`);

write('packages/database/src/prisma.service.ts', `
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
`);

write('packages/database/src/index.ts', `
export * from '@prisma/client';
export * from './prisma.service';
`);

write('packages/database/src/index.spec.ts', `
describe('Database Module', () => {
  it('should pass', () => { expect(true).toBe(true); });
});
`);

// 2. Events Primitives
write('packages/events/src/index.ts', `
export interface EventEnvelope<T = any> {
  id: string;
  name: string;
  version: number;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  data: T;
}

export abstract class DomainEvent {
  public readonly occurredOn: Date;
  constructor() {
    this.occurredOn = new Date();
  }
}
`);

write('packages/events/src/index.spec.ts', `
import { DomainEvent } from './index';
class TestEvent extends DomainEvent {}
describe('DomainEvent', () => {
  it('should initialize timestamp', () => {
    const ev = new TestEvent();
    expect(ev.occurredOn).toBeInstanceOf(Date);
  });
});
`);

// 3. Shared Package Updates
const sharedPkgPath = 'packages/shared/package.json';
const sharedPkg = JSON.parse(fs.readFileSync(sharedPkgPath, 'utf8').replace(/^\uFEFF/, ''));
sharedPkg.dependencies = sharedPkg.dependencies || {};
Object.assign(sharedPkg.dependencies, {
  "ioredis": "^5.0.0",
  "@nestjs/microservices": "^10.0.0",
  "@nestjs/terminus": "^10.0.0",
  "amqp-connection-manager": "^4.0.0",
  "amqplib": "^0.10.0",
  "nestjs-pino": "^4.0.0",
  "pino-http": "^10.0.0",
  "zod": "^3.23.0"
});
sharedPkg.devDependencies = sharedPkg.devDependencies || {};
Object.assign(sharedPkg.devDependencies, {
  "pino-pretty": "^11.0.0",
  "@types/amqplib": "^0.10.0"
});
fs.writeFileSync(sharedPkgPath, JSON.stringify(sharedPkg, null, 2), 'utf8');

write('packages/shared/src/redis/redis.service.ts', `
import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}
  
  getClient(): Redis {
    return this.client;
  }
  
  async onModuleDestroy() {
    this.client.disconnect();
  }
}
`);

write('packages/shared/src/redis/redis.module.ts', `
import { Module, DynamicModule, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({})
export class RedisModule {
  static forRoot(url: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: () => new Redis(url),
        },
        RedisService,
      ],
      exports: [RedisService],
    };
  }
}
`);

write('packages/shared/src/broker/publisher.interface.ts', `
export interface EventPublisher {
  publish<T>(routingKey: string, event: T): Promise<void>;
}
`);

write('packages/shared/src/broker/consumer.interface.ts', `
export interface EventConsumer {
  consume(queue: string, callback: (msg: any) => Promise<void>): Promise<void>;
}
`);

write('packages/shared/src/outbox/outbox.interface.ts', `
export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: string;
  createdAt: Date;
  processedAt: Date | null;
}

export interface OutboxPublisher {
  publishPending(): Promise<void>;
}
`);

write('packages/shared/src/errors/app.exception.ts', `
export class AppException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppException';
  }
}
`);

write('packages/shared/src/errors/global-exception.filter.ts', `
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      return response.status(exception.statusCode).json({
        code: exception.code,
        message: exception.message,
      });
    }

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        code: 'HTTP_ERROR',
        message: exception.message,
      });
    }

    // Unhandled internal error
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
}
`);

write('packages/shared/src/errors/app.exception.spec.ts', `
import { AppException } from './app.exception';
describe('AppException', () => {
  it('should create an error with code and message', () => {
    const err = new AppException('TEST_ERR', 'Test error', 400);
    expect(err.code).toBe('TEST_ERR');
    expect(err.message).toBe('Test error');
    expect(err.statusCode).toBe(400);
  });
});
`);

write('packages/shared/src/observability/observability.module.ts', `
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      },
    }),
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule {}
`);

write('packages/shared/src/config/env.base.ts', `
import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RABBITMQ_URL: z.string().optional(),
});
`);

write('packages/shared/src/health/health.module.ts', `
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [TerminusModule],
  exports: [TerminusModule],
})
export class HealthModule {}
`);

write('packages/shared/src/index.ts', `
export * from './redis/redis.module';
export * from './redis/redis.service';
export * from './broker/publisher.interface';
export * from './broker/consumer.interface';
export * from './outbox/outbox.interface';
export * from './errors/app.exception';
export * from './errors/global-exception.filter';
export * from './observability/observability.module';
export * from './config/env.base';
export * from './health/health.module';
`);

// 4. Update Services
const services = ['identity-service', 'organization-service', 'workspace-service'];
services.forEach(svc => {
  const envTsPath = path.join('services', svc, 'src', 'env.ts');
  const envTs = `import { z } from 'zod';
import { baseEnvSchema } from '@veerox/shared';

export const envSchema = baseEnvSchema.extend({
  // Service specific vars
});

export function validateEnv() {
  return envSchema.parse(process.env);
}
`;
  write(envTsPath, envTs);
  
  const envExamplePath = path.join('services', svc, '.env.example');
  const envExample = `PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
`;
  write(envExamplePath, envExample);
});
