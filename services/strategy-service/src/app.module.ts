import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';
﻿import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

import { StrategyController } from './api/controllers/strategy.controller';
import { ExpertAdvisorController } from './api/controllers/expert-advisor.controller';
import { StrategyOrchestrationController } from './api/controllers/strategy-orchestration.controller';
import { BacktestController } from './api/controllers/backtest.controller';

import { StrategyRepository } from './infrastructure/repositories/strategy.repository';
import { ExpertAdvisorRepository } from './infrastructure/repositories/expert-advisor.repository';
import { OpenPositionRepository } from './infrastructure/repositories/open-position.repository';
import { StrategyOrchestrationRepository } from './infrastructure/repositories/strategy-orchestration.repository';
import { ObjectStorageService } from './infrastructure/storage/object-storage.service';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';

import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { TokenService } from './infrastructure/auth/token.service';

import { RegisterStrategyHandler } from './application/handlers/register-strategy.handler';
import { EvaluateStrategyHandler } from './application/handlers/evaluate-strategy.handler';
import { PositionOpenedHandler } from './application/handlers/position-opened.handler';
import { PositionClosedHandler } from './application/handlers/position-closed.handler';
import { RegisterExpertAdvisorHandler, ChangeExpertAdvisorStatusHandler } from './application/handlers/expert-advisor.command-handlers';
import { AssignStrategyHandler } from './application/handlers/strategy-orchestration.command-handlers';
import { MarketIntelligenceUpdatedEventHandler } from './application/handlers/events/market-intelligence-updated.event-handler';
import { RunBacktestHandler } from './application/handlers/run-backtest.handler';
import { SimulationEngineService } from './domain/services/simulation-engine.service';
import { StrategyFactory } from './domain/strategies/strategy.factory';

const CommandHandlers = [
  RegisterStrategyHandler,
  EvaluateStrategyHandler,
  RegisterExpertAdvisorHandler,
  ChangeExpertAdvisorStatusHandler,
  AssignStrategyHandler,
  RunBacktestHandler,
];

const EventHandlers = [
  PositionOpenedHandler,
  PositionClosedHandler,
  MarketIntelligenceUpdatedEventHandler,
];

const Repositories = [
  StrategyRepository,
  ExpertAdvisorRepository,
  OpenPositionRepository,
  StrategyOrchestrationRepository,
  ObjectStorageService,
  {
    provide: AUDIT_REPOSITORY,
    useClass: PrismaAuditRepository,
  },
];

import { LiveRunnerModule } from './application/live-runner/live-runner.module';

@Module({
  imports: [
    ObservabilityModule,
    CqrsModule,
    LiveRunnerModule,
  ],
  controllers: [
    StrategyController,
    ExpertAdvisorController,
    StrategyOrchestrationController,
    BacktestController,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    TokenService,
    SimulationEngineService,
    StrategyFactory,
    ...Repositories,
    ...CommandHandlers,
    ...EventHandlers,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

