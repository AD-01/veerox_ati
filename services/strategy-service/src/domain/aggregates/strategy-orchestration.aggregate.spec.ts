import { StrategyOrchestration } from './strategy-orchestration.aggregate';
import { Strategy } from './strategy.aggregate';

describe('StrategyOrchestration Aggregate', () => {
  it('should initialize correctly', () => {
    const orch = new StrategyOrchestration('ws-1', 'strat-1');

    expect(orch.workspaceId).toBe('ws-1');
  });

  it('should recommend transition if high volatility and active strategy is not aggressive', () => {
    const orch = new StrategyOrchestration('ws-1', 'strat-moderate');
    
    const candidates = [
      new Strategy('strat-aggressive', 'org-1', 'A', '1', null, 'act', 'AGGRESSIVE', 'ACTIVE', new Date(), new Date())
    ];

    const recommendation = orch.evaluateAndRecommend('snap-1', {
      trendDirection: 'UP',
      trendStrength: 50,
      volatility: 80,
      liquidityScore: 90,
      regime: 'Trending',
      confidenceScore: 80,
      marketHealthScore: 70,
    }, candidates, []);

    expect(recommendation).not.toBeNull();
    expect(recommendation?.id).toBe('strat-aggressive');
  });

  it('should not recommend transition if open positions and risk is high', () => {
    const orch = new StrategyOrchestration('ws-1', 'strat-moderate');
    
    const candidates = [
      new Strategy('strat-aggressive', 'org-1', 'A', '1', null, 'act', 'AGGRESSIVE', 'ACTIVE', new Date(), new Date())
    ];

    const recommendation = orch.evaluateAndRecommend('snap-2', {
      trendDirection: 'UP',
      trendStrength: 50,
      volatility: 80,
      liquidityScore: 90,
      regime: 'Trending',
      confidenceScore: 80,
      marketHealthScore: 40,
    }, candidates, [{ id: 'pos', workspaceId: 'ws', symbolId: 'sym', strategyId: 'strat-moderate', status: 'OPEN' }]);

    expect(recommendation).toBeNull();
  });
});
