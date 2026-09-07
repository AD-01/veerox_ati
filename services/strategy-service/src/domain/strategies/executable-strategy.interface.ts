import { Tick, Candle } from '@veerox/database';

export interface StrategyContext {
  symbol: string;
  currentBalance: number;
  currentEquity: number;
  usedMargin: number;
  openPositions: Array<{
    id: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    lotSize: number;
    stopLoss?: number;
    takeProfit?: number;
    pnl: number;
    openedAt: Date;
  }>;
}

export interface StrategySignal {
  action: 'OPEN' | 'CLOSE';
  symbol: string;
  direction: 'BUY' | 'SELL';
  lotSize: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface IExecutableStrategy {
  /**
   * Called on every new tick.
   */
  onTick?(tick: Tick, context: StrategyContext): StrategySignal | null;

  /**
   * Called on every completed candle.
   */
  onCandle?(candle: Candle, context: StrategyContext): StrategySignal | null;

  /**
   * Initialization logic
   */
  initialize?(config: Record<string, unknown>): void;
}
