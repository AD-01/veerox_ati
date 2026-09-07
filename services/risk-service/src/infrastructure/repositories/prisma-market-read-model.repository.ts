import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { IMarketReadModelRepository } from '../../application/handlers/risk-assessment/evaluate-risk.command-handler';
import { MarketSnapshot } from '../../domain/interfaces/calculation-inputs.interface';

@Injectable()
export class PrismaMarketReadModelRepository implements IMarketReadModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMarketSnapshot(symbolId: string): Promise<MarketSnapshot | null> {
    const symbol = await this.prisma.symbol.findUnique({
      where: { id: symbolId },
      include: {
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (!symbol) return null;

    const snapshot = symbol.snapshots[0];
    if (!snapshot) return null;

    // Freshness check: Reject if snapshot is older than 60 seconds
    const ageMs = Date.now() - snapshot.timestamp.getTime();
    if (ageMs > 60000) return null;

    const correlations = await this.prisma.pairwiseCorrelation.findMany({
      where: {
        OR: [
          { symbolIdA: symbolId },
          { symbolIdB: symbolId }
        ]
      }
    });

    const correlationMatrix: Record<string, number> = {};
    for (const corr of correlations) {
      const targetSymbol = corr.symbolIdA === symbolId ? corr.symbolIdB : corr.symbolIdA;
      correlationMatrix[targetSymbol] = corr.correlationScore.toNumber();
    }

    return {
      volatility: snapshot.volatility.toNumber(),
      regime: snapshot.regime,
      liquidityScore: snapshot.liquidityScore,
      currentPrice: snapshot.referencePrice.toNumber(),
      contractSize: symbol.contractSize.toNumber(),
      correlationMatrix,
    };
  }
}

