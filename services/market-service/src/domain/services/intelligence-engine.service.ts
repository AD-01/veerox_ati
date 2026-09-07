import { Injectable } from '@nestjs/common';
import { MarketSnapshot } from '../aggregates/market-snapshot.aggregate';

export interface IntelligenceInput {
  symbolId: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class IntelligenceEngineService {
  /**
   * Generates a MarketSnapshot based on the latest closed candle.
   * Note: This implementation uses deterministic placeholder algorithms
   * as per S-10 Phase 03 architecture decisions.
   */
  generateSnapshot(input: IntelligenceInput): MarketSnapshot {
    const { open, high, low, close, volume } = input;

    // 1. Placeholder Trend Algorithm
    let trendDirection = 'FLAT';
    let trendStrength = 50;

    const priceChange = close - open;
    const bodySize = Math.abs(priceChange);
    const totalSize = high - low;

    if (totalSize > 0) {
      if (priceChange > 0) {
        trendDirection = 'UP';
        trendStrength = Math.round((bodySize / totalSize) * 100);
      } else if (priceChange < 0) {
        trendDirection = 'DOWN';
        trendStrength = Math.round((bodySize / totalSize) * 100);
      }
    }

    // Ensure trendStrength is bounded 0-100
    trendStrength = Math.min(Math.max(trendStrength, 0), 100);

    // 2. Placeholder Volatility Algorithm (Range relative to open price)
    const volatility = open > 0 ? totalSize / open : 0;

    // 3. Placeholder Liquidity Score Algorithm
    // Scale volume to a 0-100 score. Assuming volume 1000+ is highly liquid for this placeholder.
    let liquidityScore = Math.round((volume / 1000) * 100);
    liquidityScore = Math.min(Math.max(liquidityScore, 10), 100); // Base liquidity of 10

    // 4. Placeholder Regime Classification
    let regime = 'Uncertain';
    if (trendStrength > 70) {
      regime = 'Trending';
    } else if (trendStrength < 30) {
      regime = 'Ranging';
    } else if (volatility > 0.01) { // 1% volatility threshold
      regime = 'High Volatility';
    } else {
      regime = 'Uncertain';
    }

    // 5. Placeholder Confidence Score
    // Confidence drops if volume is zero or spread/volatility is extremely abnormal
    let confidenceScore = 90;
    if (volume === 0) confidenceScore -= 50;
    if (volatility > 0.05) confidenceScore -= 20;
    confidenceScore = Math.max(confidenceScore, 0);

    // 6. Placeholder Market Health Score
    // Health is an aggregate of liquidity and confidence
    const marketHealthScore = Math.round((liquidityScore + confidenceScore) / 2);

    return MarketSnapshot.create({
      symbolId: input.symbolId,
      timeframe: input.timeframe,
      timestamp: input.timestamp,
      referencePrice: close,
      trendDirection,
      trendStrength,
      volatility,
      liquidityScore,
      regime,
      confidenceScore,
      marketHealthScore,
    });
  }
}
