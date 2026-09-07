import { AggregateRoot } from '@nestjs/cqrs';
import { 
  StrategyTransitionRecommendedEvent, 
  StrategyEvaluationCompletedEvent,
  ExpertAdvisorAssignedEvent,
  StrategyAssignedEvent
} from '@veerox/events';
import { Strategy } from './strategy.aggregate';

export interface MarketIntelligenceSnapshot {
  trendDirection: string;
  trendStrength: number;
  volatility: number;
  liquidityScore: number;
  regime: string;
  confidenceScore: number;
  marketHealthScore: number;
}

export interface OpenPositionState {
  id: string;
  workspaceId: string;
  symbolId: string;
  strategyId: string | null;
  status: string;
}

export class StrategyOrchestration extends AggregateRoot {
  constructor(
    public readonly workspaceId: string,
    public currentStrategyId: string | null,
    public currentExpertAdvisorId: string | null = null,
  ) {
    super();
  }

  public evaluateAndRecommend(
    snapshotId: string,
    intelligence: MarketIntelligenceSnapshot,
    candidateStrategies: Strategy[],
    openPositions: OpenPositionState[],
  ): Strategy | null {
    // 1. Filter out non-active candidates
    const activeCandidates = candidateStrategies.filter(s => s.status === 'ACTIVE');

    if (activeCandidates.length === 0) {
      return null;
    }

    // 2. Simple Rule: Find best matching strategy for current regime
    let bestStrategy: Strategy | null = null;
    
    // Simplistic placeholder logic for ranking:
    // If market is Trending, prefer AGGRESSIVE/MODERATE
    // If market is Ranging/High Volatility, prefer CONSERVATIVE
    
    if (intelligence.regime === 'Trending') {
      bestStrategy = activeCandidates.find(s => s.riskProfile === 'AGGRESSIVE') 
                  || activeCandidates.find(s => s.riskProfile === 'MODERATE') 
                  || activeCandidates[0];
    } else {
      bestStrategy = activeCandidates.find(s => s.riskProfile === 'CONSERVATIVE') 
                  || activeCandidates[0];
    }

    // 3. Prevent transition if positions are open and risk is too high
    // (Open position handling SO-005)
    if (openPositions.length > 0 && this.currentStrategyId !== bestStrategy.id) {
      if (intelligence.marketHealthScore < 50) {
        // High risk, don't transition while holding positions unless forced
        this.apply(
          new StrategyEvaluationCompletedEvent(
            this.workspaceId,
            this.currentStrategyId,
            snapshotId,
            this.currentStrategyId,
            true,
            new Date(),
          )
        );
        return null; // Stick with current
      }
    }

    // 4. Record transition if changed
    if (bestStrategy && bestStrategy.id !== this.currentStrategyId) {
      this.apply(
        new StrategyTransitionRecommendedEvent(
          this.workspaceId,
          this.currentStrategyId,
          bestStrategy.id,
          `Transitioned due to market regime: ${intelligence.regime}`,
          new Date(),
        ),
      );
    }

    this.apply(
      new StrategyEvaluationCompletedEvent(
        this.workspaceId,
        this.currentStrategyId,
        snapshotId,
        bestStrategy?.id || null,
        true,
        new Date(),
      )
    );

    return bestStrategy;
  }

  public assignExpertAdvisor(strategyId: string, expertAdvisorId: string): void {
    this.currentStrategyId = strategyId;
    this.currentExpertAdvisorId = expertAdvisorId;

    this.apply(new StrategyAssignedEvent(strategyId, this.workspaceId, new Date()));
    this.apply(new ExpertAdvisorAssignedEvent(expertAdvisorId, strategyId, this.workspaceId, new Date()));
  }
}
