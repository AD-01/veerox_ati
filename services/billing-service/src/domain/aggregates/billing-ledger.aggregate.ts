import { BaseAggregateRoot } from './base.aggregate';
import { Decimal } from 'decimal.js';

export enum TransactionType {
  CHARGE = 'CHARGE',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  CREDIT = 'CREDIT'
}

export class BillingLedgerEntry extends BaseAggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly accountId: string | null,
    public readonly amount: Decimal,
    public readonly currency: string,
    public readonly transactionType: TransactionType,
    public readonly description: string,
    public readonly idempotencyKey: string,
    public readonly referenceId: string | null,
    public readonly referenceType: string | null,
    public readonly createdAt: Date
  ) {
    super();
  }

  static create(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    accountId?: string | null;
    amount: Decimal;
    currency: string;
    transactionType: TransactionType;
    description: string;
    idempotencyKey: string;
    referenceId?: string | null;
    referenceType?: string | null;
  }): BillingLedgerEntry {
    return new BillingLedgerEntry(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.accountId || null,
      props.amount,
      props.currency,
      props.transactionType,
      props.description,
      props.idempotencyKey,
      props.referenceId || null,
      props.referenceType || null,
      new Date()
    );
  }

  static restore(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    accountId: string | null;
    amount: Decimal;
    currency: string;
    transactionType: string;
    description: string;
    idempotencyKey: string;
    referenceId: string | null;
    referenceType: string | null;
    createdAt: Date;
  }): BillingLedgerEntry {
    return new BillingLedgerEntry(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.accountId,
      props.amount,
      props.currency,
      props.transactionType as TransactionType,
      props.description,
      props.idempotencyKey,
      props.referenceId,
      props.referenceType,
      props.createdAt
    );
  }
}
