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
