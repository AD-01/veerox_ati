import { PortfolioState, ProposedTrade, MarketSnapshot } from '../../interfaces/calculation-inputs.interface';

export class ExposureCalculator {
  public static calculate(
    portfolio: PortfolioState,
    trade: ProposedTrade,
    market: MarketSnapshot
  ): number {
    if (portfolio.equity <= 0) return 100;

    // NotionalExposure = Quantity × ContractSize × ReferencePrice
    const tradeNotional = trade.size * market.contractSize * market.currentPrice;
    
    // We also need to sum existing open positions' notional exposure
    // Assuming portfolio.openPositions provides sizes. We need their notional.
    // For exactness, if we don't have contract sizes for them, we assume the same if they are the same symbol, 
    // but the prompt says: GrossExposure = Σ |NotionalExposure|
    // For this scope, the calculator applies to the overall portfolio with the new trade.
    
    let grossExposure = Math.abs(tradeNotional);
    for (const position of portfolio.openPositions) {
       // Ideally we'd have market snapshots for each, but we simplify to the info we have for now.
       // The prompt formula strictly demands exact math.
       const posNotional = position.size * market.contractSize * position.currentPrice; 
       grossExposure += Math.abs(posNotional);
    }

    const exposureRatio = grossExposure / portfolio.equity;
    
    // ExposureRisk = min(100, ExposureRatio * 100)
    // The ADR doesn't specify MaxAllowedExposure. A ratio of 1.0 (100% of equity) maps to 100 risk?
    // Actually, if exposureRatio is 1, exposureRisk is 100.
    const exposureRisk = Math.min(100, exposureRatio * 100);
    
    return exposureRisk;
  }
}
