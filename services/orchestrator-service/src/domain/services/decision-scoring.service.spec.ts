import { DecisionScoringService, ScoringInputs } from './decision-scoring.service';

describe('DecisionScoringService', () => {
  let service: DecisionScoringService;

  beforeEach(() => {
    service = new DecisionScoringService();
  });

  it('should return REJECT_TRADE if dataQuality is LOW', () => {
    const inputs: ScoringInputs = {
      marketHealthScore: 100,
      marketConfidence: 100,
      marketRegime: 'TRENDING',
      strategyConfidence: 100,
      strategyMatched: true,
      riskScore: 10,
      dataQuality: 'LOW',
      historicalPerformance: 'HIGH',
    };

    const result = service.evaluate(inputs);

    expect(result.outcome).toBe('REJECT_TRADE');
    expect(result.confidenceScore).toBe(0);
    expect(result.explanation.primaryReason).toBe('Low data quality flagged');
  });

  it('should return EXECUTE_TRADE for high confidence and acceptable risk', () => {
    const inputs: ScoringInputs = {
      marketHealthScore: 100,
      marketConfidence: 100,
      marketRegime: 'TRENDING',
      strategyConfidence: 100,
      strategyMatched: true,
      riskScore: 10, // < 50
      dataQuality: 'HIGH',
      historicalPerformance: 'HIGH',
    };

    const result = service.evaluate(inputs);

    expect(result.confidenceScore).toBe(96);
    expect(result.outcome).toBe('EXECUTE_TRADE');
    expect(result.explanation.factors).toContain('HIGH_CONFIDENCE');
    expect(result.explanation.factors).toContain('LOW_RISK');
  });

  it('should return REJECT_TRADE for high confidence but high risk', () => {
    const inputs: ScoringInputs = {
      marketHealthScore: 100,
      marketConfidence: 100,
      marketRegime: 'TRENDING',
      strategyConfidence: 100,
      strategyMatched: true,
      riskScore: 60,
      dataQuality: 'HIGH',
      historicalPerformance: 'HIGH',
    };

    const result = service.evaluate(inputs);

    expect(result.confidenceScore).toBe(76);
    expect(result.outcome).toBe('REJECT_TRADE');
    expect(result.explanation.factors).toContain('HIGH_RISK');
  });

  it('should return REJECT_TRADE (not WAIT) for moderate confidence', () => {
    const inputs: ScoringInputs = {
      marketHealthScore: 50,
      marketConfidence: 50,
      marketRegime: 'TRENDING',
      strategyConfidence: 50,
      strategyMatched: true,
      riskScore: 50,
      dataQuality: 'HIGH',
      historicalPerformance: 'HIGH',
    };

    const result = service.evaluate(inputs);

    expect(result.confidenceScore).toBe(50);
    expect(result.outcome).toBe('REJECT_TRADE'); // formerly WAIT
    expect(result.explanation.factors).toContain('LOW_CONFIDENCE');
  });

  it('should apply historical performance penalty and return REJECT_TRADE', () => {
    const inputs: ScoringInputs = {
      marketHealthScore: 100,
      marketConfidence: 100,
      marketRegime: 'TRENDING',
      strategyConfidence: 100,
      strategyMatched: true,
      riskScore: 10,
      dataQuality: 'HIGH',
      historicalPerformance: 'LOW',
    };

    const result = service.evaluate(inputs);

    expect(result.confidenceScore).toBe(48);
    expect(result.outcome).toBe('REJECT_TRADE'); // because 48 < 75
  });
});
