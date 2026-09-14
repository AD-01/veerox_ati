import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxModule } from '@veerox/shared';
import { PrismaService } from '@veerox/database';

// Controllers
import { PortfolioController } from './api/controllers/portfolio.controller';

// Handlers
import { ExecutionCompletedEventHandler } from './application/handlers/execution-completed.event-handler';
import { ExecutionFailedEventHandler } from './application/handlers/execution-failed.event-handler';

// Services
import { PortfolioLedgerService } from './domain/services/portfolio-ledger.service';

// Repositories
import { TRADING_ACCOUNT_REPOSITORY } from './infrastructure/repositories/trading-account.repository';
import { PrismaTradingAccountRepository } from './infrastructure/repositories/prisma-trading-account.repository';
import { POSITION_REPOSITORY } from './infrastructure/repositories/position.repository';
import { PrismaPositionRepository } from './infrastructure/repositories/prisma-position.repository';

const EventHandlers = [
  ExecutionCompletedEventHandler,
  ExecutionFailedEventHandler,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule,
    CqrsModule,
    ScheduleModule.forRoot(),
    OutboxModule.register({
      rmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      queueName: 'portfolio_events_queue',
    }),
  ],
  controllers: [PortfolioController],
  providers: [
    PrismaService,
    PortfolioLedgerService,
    ...EventHandlers,
    {
      provide: TRADING_ACCOUNT_REPOSITORY,
      useClass: PrismaTradingAccountRepository,
    },
    {
      provide: POSITION_REPOSITORY,
      useClass: PrismaPositionRepository,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

