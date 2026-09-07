import { PortfolioState } from '../../interfaces/calculation-inputs.interface';

export class DrawdownCalculator {
  public static calculate(portfolio: PortfolioState, maxAllowedDrawdown: number): number {
    if (!portfolio.peakEquity || portfolio.peakEquity <= 0) return 0;

    const peakEquity = Math.max(portfolio.peakEquity, portfolio.equity);
    if (portfolio.equity >= peakEquity) return 0;

    // CurrentDrawdown = (PeakEquity - CurrentEquity) / PeakEquity × 100
    const currentDrawdown = ((peakEquity - portfolio.equity) / peakEquity) * 100;

    // DrawdownRisk = min(100, CurrentDrawdown / MaxAllowedDrawdown × 100)
    const drawdownRisk = Math.min(100, (currentDrawdown / maxAllowedDrawdown) * 100);

    return drawdownRisk;
  }
}
