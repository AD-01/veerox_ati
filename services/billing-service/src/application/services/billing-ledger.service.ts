/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { IBillingLedgerRepository } from '../../domain/repositories/billing-ledger.repository.interface';
import { BillingLedgerEntry, TransactionType } from '../../domain/aggregates/billing-ledger.aggregate';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { Decimal } from 'decimal.js';

@Injectable()
export class BillingLedgerService {
  constructor(
    @Inject('IBillingLedgerRepository') private readonly ledgerRepo: IBillingLedgerRepository,
    @Inject('IAuditRepository') private readonly auditRepo: IAuditRepository,
    private readonly prisma: PrismaService
  ) {}

  async recordTransaction(props: {
    organizationId: string;
    workspaceId: string;
    accountId?: string;
    amount: Decimal;
    currency: string;
    transactionType: TransactionType;
    description: string;
    idempotencyKey: string;
    referenceId?: string;
    referenceType?: string;
  }, tx?: any): Promise<void> {
    // Rely on idempotency key unique constraint in PostgreSQL to prevent duplicates
    const entry = BillingLedgerEntry.create({
      id: crypto.randomUUID(),
      ...props
    });

    await this.ledgerRepo.save(entry, tx);

    // Using tx if passed down, else it will just use standard audit logic which might not be transactional
    await this.auditRepo.log({
      action: 'LEDGER_ENTRY_CREATED',
      organizationId: props.organizationId,
      workspaceId: props.workspaceId,
      targetEntityId: entry.id,
      targetEntityType: 'BILLING_LEDGER_ENTRY',
      newState: JSON.stringify({ amount: props.amount.toString(), type: props.transactionType, idempotencyKey: props.idempotencyKey })
    }, tx);
  }
}
