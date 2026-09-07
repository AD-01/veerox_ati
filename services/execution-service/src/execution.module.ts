import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxModule } from '@veerox/shared';
import { PrismaService } from '@veerox/database';
import { ProcessPolicyResolutionHandler } from './application/handlers/process-policy-resolution.handler';
import { DispatchExecutionOrderHandler } from './application/handlers/dispatch-execution-order.handler';
import { ProcessConnectorResponseHandler } from './application/handlers/process-connector-response.handler';

export const CommandHandlers = [];
export const EventHandlers = [
  ProcessPolicyResolutionHandler,
  DispatchExecutionOrderHandler,
  ProcessConnectorResponseHandler,
];
export const QueryHandlers = [];

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(),
    OutboxModule.register({
      rmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      queueName: 'execution_events_queue',
    }),
  ],
  providers: [
    PrismaService,
    ...CommandHandlers,
    ...EventHandlers,
    ...QueryHandlers,
  ],
  exports: [],
})
export class ExecutionModule {}
