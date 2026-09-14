import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { OpenPositionState } from '../../domain/aggregates/strategy-orchestration.aggregate';

@Injectable()
export class OpenPositionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPosition(position: OpenPositionState): Promise<void> {
    await this.prisma.openPositionReadModel.upsert({
      where: { id: position.id },
      create: {
        id: position.id,
        workspaceId: position.workspaceId,
        symbolId: position.symbolId,
        strategyId: position.strategyId,
        status: position.status,
        size: 0,
        direction: 'LONG',
        openPrice: 0,
        currentPrice: 0,
        marginUsed: 0,
      },
      update: {
        status: position.status,
        strategyId: position.strategyId,
      },
    });
  }

  async removePosition(id: string): Promise<void> {
    await this.prisma.openPositionReadModel.deleteMany({
      where: { id },
    });
  }

  async findByWorkspaceAndStrategy(workspaceId: string, strategyId: string | null): Promise<OpenPositionState[]> {
    const records = await this.prisma.openPositionReadModel.findMany({
      where: { workspaceId, strategyId },
    });

    return records.map(r => ({
      id: r.id,
      workspaceId: r.workspaceId,
      symbolId: r.symbolId,
      strategyId: r.strategyId,
      status: r.status,
    }));
  }

  async findByWorkspaceAndSymbol(workspaceId: string, symbolId: string): Promise<unknown[]> {
    const records = await this.prisma.openPositionReadModel.findMany({
      where: { workspaceId, symbolId, status: 'OPEN' },
    });

    return records.map(r => ({
      id: r.id,
      symbol: r.symbolId,
      direction: r.direction as 'BUY' | 'SELL',
      entryPrice: r.openPrice.toNumber(),
      lotSize: r.size.toNumber(),
      pnl: 0, // Simplified for now, or fetch from TradingAccount / Position read model
      openedAt: r.updatedAt,
    }));
  }
}
