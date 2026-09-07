import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { MarketSnapshot } from '../../domain/aggregates/market-snapshot.aggregate';

export interface IMarketSnapshotRepository {
  upsert(snapshot: MarketSnapshot): Promise<void>;
  findBySymbolAndTimeframe(symbolId: string, timeframe: string, limit: number): Promise<MarketSnapshot[]>;
}

@Injectable()
export class MarketSnapshotRepository implements IMarketSnapshotRepository {
  private readonly logger = new Logger(MarketSnapshotRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(snapshot: MarketSnapshot): Promise<void> {
    try {
      await this.prisma.marketSnapshot.upsert({
        where: {
          symbolId_timeframe_timestamp: {
            symbolId: snapshot.symbolId,
            timeframe: snapshot.timeframe,
            timestamp: snapshot.timestamp,
          }
        },
        update: {
          referencePrice: snapshot.referencePrice,
          trendDirection: snapshot.trendDirection,
          trendStrength: snapshot.trendStrength,
          volatility: snapshot.volatility,
          liquidityScore: snapshot.liquidityScore,
          regime: snapshot.regime,
          confidenceScore: snapshot.confidenceScore,
          marketHealthScore: snapshot.marketHealthScore,
          snapshotVersion: { increment: 1 },
        },
        create: {
          id: snapshot.id,
          symbolId: snapshot.symbolId,
          timeframe: snapshot.timeframe,
          timestamp: snapshot.timestamp,
          referencePrice: snapshot.referencePrice,
          trendDirection: snapshot.trendDirection,
          trendStrength: snapshot.trendStrength,
          volatility: snapshot.volatility,
          liquidityScore: snapshot.liquidityScore,
          regime: snapshot.regime,
          confidenceScore: snapshot.confidenceScore,
          marketHealthScore: snapshot.marketHealthScore,
          snapshotVersion: snapshot.snapshotVersion,
          createdAt: snapshot.createdAt,
        },
      });
      this.logger.debug(`Upserted market snapshot for ${snapshot.symbolId} at ${snapshot.timeframe} (${snapshot.timestamp.toISOString()})`);
    } catch (error) {
      this.logger.error(`Failed to upsert market snapshot: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async findBySymbolAndTimeframe(symbolId: string, timeframe: string, limit: number = 100): Promise<MarketSnapshot[]> {
    const records = await this.prisma.marketSnapshot.findMany({
      where: {
        symbolId,
        timeframe,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });

    return records.map((record) => MarketSnapshot.reconstruct({
      id: record.id,
      symbolId: record.symbolId,
      timeframe: record.timeframe,
      timestamp: record.timestamp,
      referencePrice: record.referencePrice.toNumber(),
      trendDirection: record.trendDirection,
      trendStrength: record.trendStrength,
      volatility: record.volatility.toNumber(),
      liquidityScore: record.liquidityScore,
      regime: record.regime,
      confidenceScore: record.confidenceScore,
      marketHealthScore: record.marketHealthScore,
      snapshotVersion: record.snapshotVersion,
      createdAt: record.createdAt,
    }));
  }
}
