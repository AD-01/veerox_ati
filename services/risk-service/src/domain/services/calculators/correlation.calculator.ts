import { PortfolioState, ProposedTrade, MarketSnapshot } from '../../interfaces/calculation-inputs.interface';

export class CorrelationCalculator {
  public static calculate(
    portfolio: PortfolioState,
    trade: ProposedTrade,
    market: MarketSnapshot
  ): number {
    if (portfolio.openPositions.length === 0) return 0;
    
    let totalPositionSize = 0;
    for (const pos of portfolio.openPositions) {
      totalPositionSize += pos.size;
    }

    if (totalPositionSize === 0) return 0;

    let correlationRisk = 0;
    const matrix = market.correlationMatrix || {};

    for (const position of portfolio.openPositions) {
      // AssetCorrelation = MatrixLookup(AssetA, AssetB)
      // We look up correlation by position.symbolId in the market.correlationMatrix
      let assetCorrelation = matrix[position.symbolId] !== undefined ? matrix[position.symbolId] : 0;
      
      // If directions are opposite, correlation effect is inverted
      if (position.direction !== trade.direction) {
        assetCorrelation *= -1;
      }

      // We only care about positive correlation risk (concentration risk)
      // But the formula says Σ (AssetCorrelation × PositionSizeWeight)
      const positionSizeWeight = position.size / totalPositionSize;
      
      correlationRisk += (assetCorrelation * positionSizeWeight);
    }

    // Convert to 0-100 scale (assuming correlation is -1 to 1)
    // If correlationRisk is 1, it's 100 risk score
    return Math.max(0, Math.min(100, correlationRisk * 100));
  }
}
