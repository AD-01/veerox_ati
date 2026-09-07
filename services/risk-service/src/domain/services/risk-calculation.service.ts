import { PortfolioState, ProposedTrade, MarketSnapshot } from '../interfaces/calculation-inputs.interface';
import { RiskProfile } from '../aggregates/risk-profile.aggregate';
import { ExposureCalculator } from './calculators/exposure.calculator';
import { LeverageCalculator } from './calculators/leverage.calculator';
import { MarginCalculator } from './calculators/margin.calculator';
import { DrawdownCalculator } from './calculators/drawdown.calculator';
import { CorrelationCalculator } from './calculators/correlation.calculator';
import { DynamicPositionSizingCalculator } from './calculators/dynamic-position-sizing.calculator';
import { RiskScore } from '../entities/risk-score.value-object';
import { PositionSize } from '../entities/position-size.value-object';

export interface CalculationResult {
  riskScore: RiskScore;
  permittedSize: PositionSize | null;
  decisionOutcome: 'APPROVED' | 'REJECTED';
}

export class RiskCalculationService {
  /**
   * Orchestrates the deterministic evaluation of a proposed trade.
   */
  public evaluateRisk(
    portfolio: PortfolioState,
    market: MarketSnapshot,
    trade: ProposedTrade,
    profile: RiskProfile
  ): CalculationResult {
    // 1. Calculate individual risk dimensions
    const exposureRisk = ExposureCalculator.calculate(portfolio, trade, market);
    // Leverage assumption: default 100 if missing
    const maxLeverage = 100;
    const leverageRisk = LeverageCalculator.calculate(portfolio, trade, market, maxLeverage);
    const marginRisk = MarginCalculator.calculate(portfolio, trade, market, profile.getMarginThreshold(), maxLeverage);
    const drawdownRisk = DrawdownCalculator.calculate(portfolio, profile.getMaxDrawdown());
    const correlationRisk = CorrelationCalculator.calculate(portfolio, trade, market);

    if (exposureRisk >= 100 || leverageRisk >= 100 || marginRisk >= 100 || drawdownRisk >= 100 || correlationRisk >= 100) {
      return {
        riskScore: RiskScore.create(100),
        permittedSize: null,
        decisionOutcome: 'REJECTED'
      };
    }

    // 2. Aggregate into a normalized 0-100 Risk Score
    // RiskScore = 0.25 × ExposureRisk + 0.25 × LeverageRisk + 0.25 × MarginRisk + 0.15 × DrawdownRisk + 0.10 × CorrelationRisk
    const aggregatedScore = (
      (exposureRisk * 0.25) +
      (leverageRisk * 0.25) +
      (marginRisk * 0.25) +
      (drawdownRisk * 0.15) +
      (correlationRisk * 0.10)
    );

    const riskScore = RiskScore.create(aggregatedScore);

    // 3. Dynamic Position Sizing & Decision Outcome
    const { permittedSize, decisionOutcome } = DynamicPositionSizingCalculator.calculate(
      trade,
      riskScore.value
    );

    return {
      riskScore,
      permittedSize: permittedSize as PositionSize | null,
      decisionOutcome: decisionOutcome as 'APPROVED' | 'REJECTED'
    };
  }
}
