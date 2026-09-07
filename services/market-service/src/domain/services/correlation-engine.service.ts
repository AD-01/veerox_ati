import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';

@Injectable()
export class CorrelationEngineService {
  private readonly logger = new Logger(CorrelationEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates Pearson correlation matrix for all active symbols using recent historical candles.
   * If there is insufficient data, it throws an error to explicitly report MISSING AUTHORITATIVE UPSTREAM DEPENDENCY.
   */
  async generateCorrelationMatrix(timeframe: string, limit: number = 30): Promise<void> {
    const symbols = await this.prisma.symbol.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, standardSymbol: true },
    });

    if (symbols.length < 2) {
      this.logger.debug('Not enough active symbols to calculate correlation matrix');
      return;
    }

    // Fetch the recent candles for all active symbols
    const candlesBySymbol = new Map<string, number[]>();
    
    for (const symbol of symbols) {
      const candles = await this.prisma.candle.findMany({
        where: {
          symbolId: symbol.id,
          timeframe,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      if (candles.length < limit) {
        this.logger.error(`MISSING AUTHORITATIVE UPSTREAM DEPENDENCY: Insufficient historical candles for symbol ${symbol.standardSymbol} on timeframe ${timeframe}. Expected ${limit}, got ${candles.length}.`);
        throw new Error(`MISSING AUTHORITATIVE UPSTREAM DEPENDENCY: Insufficient historical data to calculate correlation.`);
      }

      // Store close prices, ordered chronologically (oldest first)
      const closePrices = candles.reverse().map(c => Number(c.close));
      candlesBySymbol.set(symbol.id, closePrices);
    }

    // Calculate Pairwise Pearson Correlation for all combinations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairsToUpdate: any[] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const symbolA = symbols[i];
        const symbolB = symbols[j];
        
        const pricesA = candlesBySymbol.get(symbolA.id)!;
        const pricesB = candlesBySymbol.get(symbolB.id)!;
        
        const correlation = this.calculatePearsonCorrelation(pricesA, pricesB);
        
        pairsToUpdate.push({
          symbolIdA: symbolA.id,
          symbolIdB: symbolB.id,
          correlationScore: correlation,
          timeframe,
        });
        
        // Also add reverse direction to make lookups easy
        pairsToUpdate.push({
          symbolIdA: symbolB.id,
          symbolIdB: symbolA.id,
          correlationScore: correlation,
          timeframe,
        });
      }
    }

    // Upsert all correlations
    for (const pair of pairsToUpdate) {
      await this.prisma.pairwiseCorrelation.upsert({
        where: {
          symbolIdA_symbolIdB_timeframe: {
            symbolIdA: pair.symbolIdA,
            symbolIdB: pair.symbolIdB,
            timeframe: pair.timeframe,
          }
        },
        update: {
          correlationScore: pair.correlationScore,
          updatedAt: new Date(),
        },
        create: {
          symbolIdA: pair.symbolIdA,
          symbolIdB: pair.symbolIdB,
          correlationScore: pair.correlationScore,
          timeframe: pair.timeframe,
        }
      });
    }

    this.logger.log(`Successfully updated correlation matrix for ${timeframe}. Updated ${pairsToUpdate.length} pairs.`);
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    
    // Bounded to [-1, 1] for safety
    return Math.max(-1, Math.min(1, numerator / denominator));
  }
}
