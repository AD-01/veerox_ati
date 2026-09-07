import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { ITradingAccountRepository } from './trading-account.repository';
import { TradingAccountAggregate } from '../../domain/aggregates/trading-account.aggregate';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaTradingAccountRepository implements ITradingAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<TradingAccountAggregate | null> {
    const client = tx || this.prisma;
    const data = await client.tradingAccount.findUnique({
      where: { id },
    });

    if (!data) return null;

    return new TradingAccountAggregate(
      data.id,
      data.organizationId,
      data.workspaceId,
      data.connectorId,
      data.currency,
      new Decimal(data.balance.toString()),
      new Decimal(data.equity.toString()),
      new Decimal(data.realizedPnl.toString()),
      new Decimal(data.unrealizedPnl.toString()),
      new Decimal(data.marginUsed.toString()),
      new Decimal(data.freeMargin.toString()),
      data.version
    );
  }

  async save(account: TradingAccountAggregate, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;

    const { count } = await client.tradingAccount.updateMany({
      where: {
        id: account.id,
        version: account.version,
      },
      data: {
        balance: account.balance.toNumber(),
        equity: account.equity.toNumber(),
        realizedPnl: account.realizedPnl.toNumber(),
        unrealizedPnl: account.unrealizedPnl.toNumber(),
        marginUsed: account.marginUsed.toNumber(),
        freeMargin: account.freeMargin.toNumber(),
        version: account.version + 1,
      },
    });

    if (count === 0) {
      throw new Error(`Concurrency error: TradingAccount ${account.id} was updated by another transaction.`);
    }

    account.version += 1;
  }
}
