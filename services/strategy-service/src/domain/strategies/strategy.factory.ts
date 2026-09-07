import { Injectable } from '@nestjs/common';
import { IExecutableStrategy, StrategyContext, StrategySignal } from './executable-strategy.interface';
import { Candle } from '@veerox/database';

// Example Mock Strategy
class MovingAverageCrossStrategy implements IExecutableStrategy {
  private config: Record<string, unknown> = {};
  
  initialize(config: Record<string, unknown>) {
    this.config = config;
  }

  onCandle(candle: Candle, context: StrategyContext): StrategySignal | null {
    // Basic mock logic: always buy on odd minutes
    const minute = new Date(candle.timestamp).getMinutes();
    if (minute % 2 !== 0 && context.openPositions.length === 0) {
      return {
        action: 'OPEN' as const,
        symbol: context.symbol,
        direction: 'BUY' as const,
        lotSize: 0.1,
      };
    } else if (minute % 2 === 0 && context.openPositions.length > 0) {
      // Wait for exit
    }
    return null;
  }
}

@Injectable()
export class StrategyFactory {
  private readonly strategies = new Map<string, new () => IExecutableStrategy>();

  constructor() {
    this.register('MA_CROSS', MovingAverageCrossStrategy);
  }

  register(code: string, strategyClass: new () => IExecutableStrategy) {
    this.strategies.set(code, strategyClass);
  }

  create(code: string): IExecutableStrategy {
    const StrategyClass = this.strategies.get(code);
    if (!StrategyClass) {
      throw new Error(`Executable strategy code ${code} not found in factory.`);
    }
    return new StrategyClass();
  }
}
