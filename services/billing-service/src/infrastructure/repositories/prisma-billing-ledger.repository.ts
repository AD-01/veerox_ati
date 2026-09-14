import { Injectable } from '@nestjs/common';
import { IBillingLedgerRepository } from '../../domain/repositories/billing-ledger.repository.interface';
import { BillingLedgerEntry } from '../../domain/aggregates/billing-ledger.aggregate';
import { PrismaService } from '@veerox/database';
import { Prisma } from '@veerox/database';

@Injectable()
export class PrismaBillingLedgerRepository implements IBillingLedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(entry: BillingLedgerEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    
    await client.billingLedgerEntry.create({
      data: {
        id: entry.id,
        organizationId: entry.organizationId,
        workspaceId: entry.workspaceId,
        amount: entry.amount,
        currency: entry.currency,
        transactionType: entry.transactionType,
        description: entry.description,
        idempotencyKey: entry.idempotencyKey,
        referenceId: entry.referenceId,
        referenceType: entry.referenceType,
        createdAt: entry.createdAt,
      },
    });
    
    entry.commit();
  }
}
