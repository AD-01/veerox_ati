import { PortfolioState, ProposedTrade, MarketSnapshot } from '../../interfaces/calculation-inputs.interface';

export class MarginCalculator {
  public static calculate(
    portfolio: PortfolioState, 
    trade: ProposedTrade, 
    market: MarketSnapshot,
    maxMarginUtilization: number,
    leverage: number = 100
  ): number {
    if (portfolio.equity <= 0) return 100;

    const tradeNotional = trade.size * market.contractSize * market.currentPrice;
    const projectedMarginIncrease = tradeNotional / leverage;
    
    // Total used margin after trade
    const usedMargin = portfolio.margin + projectedMarginIncrease;

    // MarginUtilization = UsedMargin / Equity × 100
    const marginUtilization = (usedMargin / portfolio.equity) * 100;

    // MarginRisk = min(100, MarginUtilization / MaxMarginUtilization × 100)
    const marginRisk = Math.min(100, (marginUtilization / maxMarginUtilization) * 100);

    return marginRisk;
  }
}
