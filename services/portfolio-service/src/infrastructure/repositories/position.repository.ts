import { PositionAggregate } from '../../domain/aggregates/position.aggregate';
import { Prisma } from '@prisma/client';

export const POSITION_REPOSITORY = 'POSITION_REPOSITORY';

export interface IPositionRepository {
  findActiveBySymbol(accountId: string, symbolId: string, tx?: Prisma.TransactionClient): Promise<PositionAggregate | null>;
  save(position: PositionAggregate, tx?: Prisma.TransactionClient): Promise<void>;
}
