import { DynamicModule, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientProxyFactory, Transport, RmqOptions } from '@nestjs/microservices';
import { OutboxService } from './outbox.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { PrismaService } from '@veerox/database';

export interface OutboxModuleOptions {
  rmqUrl: string;
  queueName: string;
}

@Module({})
export class OutboxModule {
  static register(options: OutboxModuleOptions): DynamicModule {
    return {
      module: OutboxModule,
      imports: [],
      providers: [
        PrismaService,
        OutboxService,
        OutboxPublisherService,
        {
          provide: 'OUTBOX_RABBITMQ_CLIENT',
          useFactory: () => {
            return ClientProxyFactory.create({
              transport: Transport.RMQ,
              options: {
                urls: [options.rmqUrl],
                queue: options.queueName,
                queueOptions: {
                  durable: true,
                },
              },
            });
          },
        },
      ],
      exports: [OutboxService, 'OUTBOX_RABBITMQ_CLIENT'],
    };
  }
}
