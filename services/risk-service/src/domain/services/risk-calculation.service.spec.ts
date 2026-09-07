import { RiskCalculationService } from './risk-calculation.service';
import { PortfolioState, MarketSnapshot, ProposedTrade } from '../interfaces/calculation-inputs.interface';
import { RiskProfile } from '../aggregates/risk-profile.aggregate';

describe('RiskCalculationService', () => {
  let service: RiskCalculationService;

  beforeEach(() => {
    service = new RiskCalculationService();
  });

  it('should evaluate a standard trade with MODERATE risk', () => {
    const portfolio: PortfolioState = {
      balance: 10000,
      equity: 10000,
      margin: 1000,
      freeMargin: 9000,
      peakEquity: 10000,
      openPositions: [],
    };

    const market: MarketSnapshot = {
      volatility: 0.05,
      regime: 'TRENDING',
      liquidityScore: 90,
      currentPrice: 1.0,
      contractSize: 100000,
      correlationMatrix: {},
    };

    const trade: ProposedTrade = {
      symbolId: 'EURUSD',
      direction: 'LONG',
      size: 0.05,
    };

    const profile = new RiskProfile('1', 'org', 'ws', 5, 20, 10, 5, 50, 'ACTIVE');

    const result = service.evaluateRisk(portfolio, market, trade, profile);

    expect(result.decisionOutcome).toBe('APPROVED');
    expect(result.riskScore.value).toBeGreaterThan(0);
    expect(result.permittedSize?.value).toBeGreaterThan(0);
  });

  it('should REJECT a trade if drawdown exceeds limits', () => {
    const portfolio: PortfolioState = {
      balance: 10000,
      equity: 7000, // 30% drawdown
      margin: 1000,
      freeMargin: 6000,
      peakEquity: 10000,
      openPositions: [],
    };

    const market: MarketSnapshot = {
      volatility: 0.05,
      regime: 'TRENDING',
      liquidityScore: 90,
      currentPrice: 1.0,
      contractSize: 100000,
      correlationMatrix: {},
    };

    const trade: ProposedTrade = {
      symbolId: 'EURUSD',
      direction: 'LONG',
      size: 1.0,
    };

    const profile = new RiskProfile('1', 'org', 'ws', 5, 20, 10, 5, 50, 'ACTIVE');

    const result = service.evaluateRisk(portfolio, market, trade, profile);

    expect(result.decisionOutcome).toBe('REJECTED');
  });

  it('should dynamically limit position size based on equity', () => {
    const portfolio: PortfolioState = {
      balance: 1000, // Small equity
      equity: 1000,
      margin: 100,
      freeMargin: 900,
      peakEquity: 1000,
      openPositions: [],
    };

    const market: MarketSnapshot = {
      volatility: 0.05,
      regime: 'TRENDING',
      liquidityScore: 90,
      currentPrice: 1.0,
      contractSize: 100000,
      correlationMatrix: {},
    };

    const trade: ProposedTrade = {
      symbolId: 'EURUSD',
      direction: 'LONG',
      size: 5.0, // Wants 5 lots
    };

    const profile = new RiskProfile('1', 'org', 'ws', 5, 20, 10, 5, 50, 'ACTIVE');

    const result = service.evaluateRisk(portfolio, market, trade, profile);

    expect(result.decisionOutcome).toBe('REJECTED');
    expect(result.permittedSize).toBeNull();
  });
});
