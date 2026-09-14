import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

import { ScheduleModule } from '@nestjs/schedule';
import { AIRecommendationExecutionRequestedEventHandler } from './application/handlers/ai-recommendation-execution-requested.event-handler';
import { TradingOpportunityEventHandler } from './application/handlers/trading-opportunity.event-handler';
import { SignalResolverWorker } from './application/workers/signal-resolver.worker';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';

@Module({
  imports: [
    ObservabilityModule,CqrsModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [
    PrismaService,
    AIRecommendationExecutionRequestedEventHandler,
    TradingOpportunityEventHandler,
    SignalResolverWorker
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
