import { Injectable } from '@nestjs/common';
import { DecisionExplanation, DecisionOutcome } from '../aggregates/decision.aggregate';

export interface ScoringInputs {
  marketHealthScore: number;
  marketConfidence: number;
  marketRegime: string;
  strategyConfidence: number;
  strategyMatched: boolean;
  riskScore: number;
  dataQuality: 'HIGH' | 'LOW';
  historicalPerformance: 'HIGH' | 'LOW';
}

export interface ScoringResult {
  outcome: DecisionOutcome;
  confidenceScore: number;
  explanation: DecisionExplanation;
}

@Injectable()
export class DecisionScoringService {
  public evaluate(inputs: ScoringInputs): ScoringResult {
    // 1. Fail Closed on missing data or bad quality
    if (inputs.dataQuality === 'LOW') {
      return {
        outcome: 'REJECT_TRADE',
        confidenceScore: 0,
        explanation: {
          primaryReason: 'Low data quality flagged',
          riskImpact: 100,
          marketRegime: inputs.marketRegime,
          strategyMatched: inputs.strategyMatched,
          factors: ['DATA_QUALITY_LOW']
        }
      };
    }

    // ADR-12.3.02: Confidence Score Formula
    // Confidence = (MarketHealthScore * 0.3) + (StrategyConfidence * 0.3) + ((100 - RiskScore) * 0.4)
    let confidenceScore = 
      (inputs.marketHealthScore * 0.3) + 
      (inputs.strategyConfidence * 0.3) + 
      ((100 - inputs.riskScore) * 0.4);

    // Penalty for historical performance
    if (inputs.historicalPerformance === 'LOW') {
      confidenceScore = confidenceScore * 0.5;
    }

    confidenceScore = Math.min(100, Math.max(0, Math.round(confidenceScore * 100) / 100));

    let outcome: DecisionOutcome;
    let primaryReason: string;
    const factors: string[] = [];

    if (confidenceScore >= 75) {
      if (inputs.riskScore < 50) {
        outcome = 'EXECUTE_TRADE';
        primaryReason = 'High confidence and acceptable risk';
        factors.push('HIGH_CONFIDENCE', 'LOW_RISK');
      } else {
        outcome = 'REJECT_TRADE';
        primaryReason = 'High risk despite high confidence';
        factors.push('HIGH_CONFIDENCE', 'HIGH_RISK');
      }
    } else {
      outcome = 'REJECT_TRADE';
      primaryReason = 'Low confidence score';
      factors.push('LOW_CONFIDENCE');
    }

    return {
      outcome,
      confidenceScore,
      explanation: {
        primaryReason,
        riskImpact: inputs.riskScore,
        marketRegime: inputs.marketRegime,
        strategyMatched: inputs.strategyMatched,
        factors
      }
    };
  }
}
