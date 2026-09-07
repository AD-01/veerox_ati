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
