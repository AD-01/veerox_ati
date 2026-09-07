import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { DecisionController } from './api/controllers/decision.controller';
import { GenerateDecisionCommandHandler, MARKET_READ_MODEL_REPOSITORY, AUDIT_REPOSITORY } from './application/handlers/generate-decision.command-handler';
import { TradingOpportunityEventHandler } from './application/handlers/trading-opportunity.event-handler';
import { RiskCalculatedEventHandler } from './application/handlers/risk-calculated.event-handler';
import { StrategyMetricsUpdatedEventHandler } from './application/handlers/strategy-metrics-updated.event-handler';
import { DecisionScoringService } from './domain/services/decision-scoring.service';
import { DecisionRepository, DECISION_REPOSITORY } from './infrastructure/repositories/decision.repository';

import { CorrelationService } from './application/services/correlation.service';

// Mock dependencies for compilation
class MockMarketReadModelRepository {
  async getMarketSnapshot() { return { timestamp: new Date(), marketHealthScore: 80, confidenceScore: 90, regime: 'Trending' }; }
}

class MockAuditRepository {
  async log() { return; }
}

@Module({
  imports: [CqrsModule],
  controllers: [DecisionController],
  providers: [
    PrismaService,
    DecisionScoringService,
    CorrelationService,
    { provide: DECISION_REPOSITORY, useClass: DecisionRepository },
    { provide: MARKET_READ_MODEL_REPOSITORY, useClass: MockMarketReadModelRepository },
    { provide: AUDIT_REPOSITORY, useClass: MockAuditRepository },
    GenerateDecisionCommandHandler,
    TradingOpportunityEventHandler,
    RiskCalculatedEventHandler,
    StrategyMetricsUpdatedEventHandler
  ],
})
export class AppModule {}
