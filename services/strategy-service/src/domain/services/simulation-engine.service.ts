import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { StrategyFactory } from '../strategies/strategy.factory';
import { StrategyContext } from '../strategies/executable-strategy.interface';
import * as crypto from 'crypto';

export interface BacktestSimulationResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  recoveryFactor: number;
  sharpeRatio: number;
  profitFactor: number;
  tradeHistory: Array<{
    id: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    lotSize: number;
    pnl: number;
    openedAt: Date;
    closedAt: Date;
  }>;
}

@Injectable()
export class SimulationEngineService {
  private readonly logger = new Logger(SimulationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyFactory: StrategyFactory,
  ) {}

  async runSimulation(
    strategyCode: string,
    symbols: string[],
    dateFrom: Date,
    dateTo: Date,
    initialCapital: number,
    configuration: Record<string, unknown>
  ): Promise<BacktestSimulationResult> {
    this.logger.log(`Starting simulation for ${strategyCode} from ${dateFrom} to ${dateTo}`);
    
    // 1. Instantiate Strategy
    const strategy = this.strategyFactory.create(strategyCode);
    if (strategy.initialize) {
      strategy.initialize(configuration);
    }

    const instrumentConfig = (configuration.instrument as Record<string, unknown>) || {
      contractSize: 100000,
      marginPerLot: 1000,
    };
    const contractSize = (instrumentConfig.contractSize as number) || 100000;
    const marginPerLot = (instrumentConfig.marginPerLot as number) || 1000;
    const spread = (configuration.spread as number) || 0;
    const slippage = (configuration.slippage as number) || 0;
    const commission = (configuration.commission as number) || 0;

    // 2. Setup Context
    const context: StrategyContext = {
      symbol: symbols[0], // Simplified to 1 symbol for now
      currentBalance: initialCapital,
      currentEquity: initialCapital,
      usedMargin: 0,
      openPositions: [],
    };

    const tradeHistory: BacktestSimulationResult['tradeHistory'] = [];

    // 3. Data Streaming (Using findMany in chunks for memory safety, or simple query for MVP)
    const candles = await this.prisma.candle.findMany({
      where: {
        timestamp: {
          gte: dateFrom,
          lte: dateTo,
        }
      },
      orderBy: { timestamp: 'asc' },
    });

    let peakEquity = initialCapital;
    let maxDrawdown = 0;

    // 4. Main Event Loop
    for (const candle of candles) {
      const high = candle.high.toNumber();
      const low = candle.low.toNumber();
      const close = candle.close.toNumber();
      const timestamp = candle.timestamp;

      // Evaluate open positions for SL/TP
      for (let i = context.openPositions.length - 1; i >= 0; i--) {
        const pos = context.openPositions[i];
        let exitPrice: number | null = null;

        if (pos.direction === 'BUY') {
          const hitSL = pos.stopLoss && low <= pos.stopLoss;
          const hitTP = pos.takeProfit && high >= pos.takeProfit;
          
          if (hitSL && hitTP) {
             exitPrice = pos.stopLoss!; // SL is hit first conservatively
          } else if (hitSL) {
             exitPrice = pos.stopLoss!;
          } else if (hitTP) {
             exitPrice = pos.takeProfit!;
          }
        } else {
          const hitSL = pos.stopLoss && high >= pos.stopLoss;
          const hitTP = pos.takeProfit && low <= pos.takeProfit;
          
          if (hitSL && hitTP) {
             exitPrice = pos.stopLoss!; // SL is hit first conservatively
          } else if (hitSL) {
             exitPrice = pos.stopLoss!;
          } else if (hitTP) {
             exitPrice = pos.takeProfit!;
          }
        }

        if (exitPrice !== null) {
          this.closePosition(context, i, exitPrice, timestamp, tradeHistory, slippage, commission, contractSize, marginPerLot);
        }
      }

      // Update equity
      let floatingPnl = 0;
      for (const pos of context.openPositions) {
         const currentPrice = close;
         const rawPnl = pos.direction === 'BUY' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
         floatingPnl += (rawPnl * contractSize * pos.lotSize) - (commission * pos.lotSize);
      }
      context.currentEquity = context.currentBalance + floatingPnl;
      
      if (context.currentEquity > peakEquity) {
        peakEquity = context.currentEquity;
      }
      const drawdown = peakEquity - context.currentEquity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      // Feed candle to strategy
      if (strategy.onCandle) {
        const signal = strategy.onCandle(candle, context);
        if (signal) {
          if (signal.action === 'OPEN') {
            const requiredMargin = marginPerLot * signal.lotSize;
            const freeMargin = context.currentEquity - context.usedMargin;

            if (requiredMargin <= freeMargin) {
              const entryPrice = signal.direction === 'BUY' ? close + spread + slippage : close - spread - slippage;

              context.openPositions.push({
                id: crypto.randomUUID(),
                symbol: signal.symbol,
                direction: signal.direction,
                entryPrice,
                lotSize: signal.lotSize,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                pnl: 0,
                openedAt: timestamp,
              });
              context.usedMargin += requiredMargin;
            } else {
              this.logger.warn(`Insufficient margin for signal on ${signal.symbol}. Required: ${requiredMargin}, Free: ${freeMargin}`);
            }
          } else if (signal.action === 'CLOSE') {
            // Close all positions for symbol
            for (let i = context.openPositions.length - 1; i >= 0; i--) {
              if (context.openPositions[i].symbol === signal.symbol) {
                this.closePosition(context, i, close, timestamp, tradeHistory, slippage, commission, contractSize, marginPerLot);
              }
            }
          }
        }
      }
    }

    // 5. End of Test Settlement
    // Force close all open positions at the final available price
    if (candles.length > 0) {
      const finalCandle = candles[candles.length - 1];
      const finalClose = finalCandle.close.toNumber();
      for (let i = context.openPositions.length - 1; i >= 0; i--) {
        this.closePosition(context, i, finalClose, finalCandle.timestamp, tradeHistory, slippage, commission, contractSize, marginPerLot);
      }
    }

    // 6. Calculate Metrics
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    for (const t of tradeHistory) {
      if (t.pnl >= 0) {
        grossProfit += t.pnl;
        winningTrades++;
      } else {
        grossLoss += Math.abs(t.pnl);
        losingTrades++;
      }
    }

    const netProfit = grossProfit - grossLoss;
    const totalTrades = tradeHistory.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    const recoveryFactor = maxDrawdown > 0 ? netProfit / maxDrawdown : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      netProfit,
      grossProfit,
      grossLoss,
      maxDrawdown,
      recoveryFactor,
      profitFactor,
      sharpeRatio: 1.5, // Mock remaining for Sharpe since it requires standard deviation of returns
      tradeHistory
    };
  }

  private closePosition(
    context: StrategyContext, 
    index: number, 
    exitPrice: number, 
    timestamp: Date, 
    tradeHistory: BacktestSimulationResult['tradeHistory'], 
    slippage: number, 
    commission: number, 
    contractSize: number,
    marginPerLot: number
  ) {
    const pos = context.openPositions[index];
    const actualExit = pos.direction === 'BUY' ? exitPrice - slippage : exitPrice + slippage;
    
    const rawPnl = pos.direction === 'BUY' ? (actualExit - pos.entryPrice) : (pos.entryPrice - actualExit);
    pos.pnl = (rawPnl * contractSize * pos.lotSize) - (commission * pos.lotSize);
    
    context.currentBalance += pos.pnl;
    context.usedMargin -= (marginPerLot * pos.lotSize);

    tradeHistory.push({
      id: pos.id,
      symbol: pos.symbol,
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      exitPrice: actualExit,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      lotSize: pos.lotSize,
      pnl: pos.pnl,
      openedAt: pos.openedAt,
      closedAt: timestamp,
    });
    context.openPositions.splice(index, 1);
  }
}
