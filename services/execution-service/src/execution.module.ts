import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxModule } from '@veerox/shared';
import { PrismaService } from '@veerox/database';
import { ProcessPolicyResolutionHandler } from './application/handlers/process-policy-resolution.handler';
import { DispatchExecutionOrderHandler } from './application/handlers/dispatch-execution-order.handler';
import { ProcessConnectorResponseHandler } from './application/handlers/process-connector-response.handler';
import { ExecutionSweeperWorker } from './application/workers/execution-sweeper.worker';
import { GetExecutionOrdersHandler } from './application/queries/get-execution-orders.query';
import { ExecutionOrderController } from './api/controllers/execution-order.controller';
import { ConnectorResponseController } from './api/controllers/connector-response.controller';

import { SubmitManualTradeHandler } from './application/handlers/submit-manual-trade.handler';

export const CommandHandlers = [SubmitManualTradeHandler];
export const EventHandlers = [
  ProcessPolicyResolutionHandler,
  DispatchExecutionOrderHandler,
  ProcessConnectorResponseHandler,
];
export const Workers = [ExecutionSweeperWorker];
export const QueryHandlers = [GetExecutionOrdersHandler];

@Module({
  imports: [
    CqrsModule,
    ScheduleModule.forRoot(),
    OutboxModule.register({
      rmqUrl: process.env.NODE_ENV === 'production' ? process.env.RABBITMQ_URL! : (process.env.RABBITMQ_URL || 'amqp://localhost:5672'),
      queueName: 'execution_events_queue',
    }),
  ],
  controllers: [ExecutionOrderController, ConnectorResponseController],
  providers: [
    PrismaService,
    ...CommandHandlers,
    ...EventHandlers,
    ...QueryHandlers,
    ...Workers,
  ],
  exports: [],
})
export class ExecutionModule {}
