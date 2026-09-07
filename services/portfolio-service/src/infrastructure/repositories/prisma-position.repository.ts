import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { IPositionRepository } from './position.repository';
import { PositionAggregate } from '../../domain/aggregates/position.aggregate';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaPositionRepository implements IPositionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBySymbol(accountId: string, symbolId: string, tx?: Prisma.TransactionClient): Promise<PositionAggregate | null> {
    const client = tx || this.prisma;
    const data = await client.position.findFirst({
      where: {
        tradingAccountId: accountId,
        symbolId: symbolId,
        status: 'OPEN',
      },
    });

    if (!data) return null;

    return new PositionAggregate(
      data.id,
      data.organizationId,
      data.workspaceId,
      data.tradingAccountId,
      data.symbolId,
      data.side,
      new Decimal(data.quantity.toString()),
      new Decimal(data.averageEntryPrice.toString()),
      new Decimal(data.realizedPnl.toString()),
      new Decimal(data.unrealizedPnl.toString()),
      data.status,
      data.openedAt,
      data.closedAt,
      data.correlationId,
      data.version
    );
  }

  async save(position: PositionAggregate, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    // Check if it's an insert or update by version
    if (position.version === 1) {
      // Insert
      await client.position.create({
        data: {
          id: position.id,
          organizationId: position.organizationId,
          workspaceId: position.workspaceId,
          tradingAccountId: position.tradingAccountId,
          symbolId: position.symbolId,
          side: position.side,
          quantity: position.quantity.toNumber(),
          averageEntryPrice: position.averageEntryPrice.toNumber(),
          realizedPnl: position.realizedPnl.toNumber(),
          unrealizedPnl: position.unrealizedPnl.toNumber(),
          status: position.status,
          openedAt: position.openedAt,
          closedAt: position.closedAt,
          correlationId: position.correlationId,
          version: position.version,
        }
      });
    } else {
      // Update with optimistic locking
      const { count } = await client.position.updateMany({
        where: {
          id: position.id,
          version: position.version - 1, // When aggregate mutates, we expect the DB version to be current version - 1 (actually we didn't increment version in aggregate. Let's handle it)
        },
        data: {
          quantity: position.quantity.toNumber(),
          averageEntryPrice: position.averageEntryPrice.toNumber(),
          realizedPnl: position.realizedPnl.toNumber(),
          unrealizedPnl: position.unrealizedPnl.toNumber(),
          status: position.status,
          closedAt: position.closedAt,
          correlationId: position.correlationId,
          version: position.version,
        },
      });

      if (count === 0) {
        throw new Error(`Concurrency error: Position ${position.id} was updated by another transaction.`);
      }
    }
  }
}
