import { TradingAccountAggregate } from '../../domain/aggregates/trading-account.aggregate';
import { Prisma } from '@prisma/client';

export const TRADING_ACCOUNT_REPOSITORY = 'TRADING_ACCOUNT_REPOSITORY';

export interface ITradingAccountRepository {
  findById(id: string, tx?: Prisma.TransactionClient): Promise<TradingAccountAggregate | null>;
  save(account: TradingAccountAggregate, tx?: Prisma.TransactionClient): Promise<void>;
}
