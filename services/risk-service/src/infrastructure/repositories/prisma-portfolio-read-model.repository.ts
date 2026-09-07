import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { IPortfolioReadModelRepository } from '../../application/handlers/risk-assessment/evaluate-risk.command-handler';
import { PortfolioState } from '../../domain/interfaces/calculation-inputs.interface';

@Injectable()
export class PrismaPortfolioReadModelRepository implements IPortfolioReadModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolioState(workspaceId: string, accountId: string): Promise<PortfolioState | null> {
    const stats = await this.prisma.accountStatistics.findFirst({
      where: { accountId },
      orderBy: { snapshotTime: 'desc' },
    });

    if (!stats) return null;

    // Freshness check: Reject if portfolio state is older than 5 minutes
    const ageMs = Date.now() - stats.snapshotTime.getTime();
    if (ageMs > 300000) return null;

    const openPositions = await this.prisma.openPositionReadModel.findMany({
      where: { workspaceId }
    });

    return {
      balance: stats.balance.toNumber(),
      equity: stats.equity.toNumber(),
      margin: stats.margin.toNumber(),
      freeMargin: stats.freeMargin.toNumber(),
      peakEquity: stats.peakEquity.toNumber(),
      openPositions: openPositions.map(op => ({
        symbolId: op.symbolId,
        direction: op.direction as 'LONG' | 'SHORT',
        size: op.size.toNumber(),
        openPrice: op.openPrice.toNumber(),
        currentPrice: op.currentPrice.toNumber(),
        floatingProfit: 0, // Computed upstream and included in stats.equity
        marginUsed: op.marginUsed.toNumber(),
      }))
    };
  }
}
