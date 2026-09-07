export interface ProposedTrade {
  symbolId: string;
  direction: 'LONG' | 'SHORT';
  size: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OpenPosition {
  symbolId: string;
  direction: 'LONG' | 'SHORT';
  size: number;
  openPrice: number;
  currentPrice: number;
  floatingProfit: number;
  marginUsed: number;
}

export interface PortfolioState {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  peakEquity?: number;
  openPositions: OpenPosition[];
}

export interface MarketSnapshot {
  volatility: number;
  regime: string;
  liquidityScore: number;
  currentPrice: number;
  contractSize: number;
  correlationMatrix?: Record<string, number>;
}
