import { Module } from '@nestjs/common';
import { LiveRunnerService } from '../../domain/services/live-runner.service';
import { MarketDataUpdatedEventHandler } from './market-data-updated.handler';
import { StrategyFactory } from '../../domain/strategies/strategy.factory';
import { StrategyOrchestrationRepository } from '../../infrastructure/repositories/strategy-orchestration.repository';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';

@Module({
  providers: [
    LiveRunnerService,
    MarketDataUpdatedEventHandler,
    StrategyFactory,
    StrategyOrchestrationRepository,
    OpenPositionRepository,
  ],
  exports: [LiveRunnerService],
})
export class LiveRunnerModule {}
