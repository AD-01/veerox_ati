import { PortfolioState, ProposedTrade, MarketSnapshot } from '../../interfaces/calculation-inputs.interface';

export class LeverageCalculator {
  public static calculate(
    portfolio: PortfolioState,
    trade: ProposedTrade,
    market: MarketSnapshot,
    maxAllowedLeverage: number = 100
  ): number {
    if (portfolio.equity <= 0) return 100;

    // Calculate GrossExposure
    const tradeNotional = trade.size * market.contractSize * market.currentPrice;
    let grossExposure = Math.abs(tradeNotional);
    for (const position of portfolio.openPositions) {
       const posNotional = position.size * market.contractSize * position.currentPrice; 
       grossExposure += Math.abs(posNotional);
    }

    const actualLeverage = grossExposure / portfolio.equity;
    const leverageRisk = Math.min(100, (actualLeverage / maxAllowedLeverage) * 100);
    
    return leverageRisk;
  }
}
