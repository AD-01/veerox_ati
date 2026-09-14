import { BaseAggregateRoot } from './base.aggregate';
import { Decimal } from 'decimal.js';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export class PaymentAttempt extends BaseAggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly invoiceId: string,
    public readonly provider: string,
    public providerPaymentId: string | null,
    public readonly amount: Decimal,
    public readonly currency: string,
    public status: PaymentStatus,
    public errorMessage: string | null,
    public readonly idempotencyKey: string
  ) {
    super();
  }

  static create(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    invoiceId: string;
    provider: string;
    amount: Decimal;
    currency: string;
    idempotencyKey: string;
  }): PaymentAttempt {
    return new PaymentAttempt(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.invoiceId,
      props.provider,
      null,
      props.amount,
      props.currency,
      PaymentStatus.PENDING,
      null,
      props.idempotencyKey
    );
  }

  static restore(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    invoiceId: string;
    provider: string;
    providerPaymentId: string | null;
    amount: Decimal;
    currency: string;
    status: string;
    errorMessage: string | null;
    idempotencyKey: string;
  }): PaymentAttempt {
    return new PaymentAttempt(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.invoiceId,
      props.provider,
      props.providerPaymentId,
      props.amount,
      props.currency,
      props.status as PaymentStatus,
      props.errorMessage,
      props.idempotencyKey
    );
  }

  markAsProcessing(): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error(`Cannot transition to processing from ${this.status}`);
    }
    this.status = PaymentStatus.PROCESSING;
  }

  markAsSuccess(providerPaymentId: string): void {
    if (this.status !== PaymentStatus.PENDING && this.status !== PaymentStatus.PROCESSING) {
      throw new Error(`Cannot mark payment as success from ${this.status}`);
    }

    this.status = PaymentStatus.SUCCESS;
    this.providerPaymentId = providerPaymentId;
  }

  markAsFailed(errorMessage: string): void {
    if (this.status !== PaymentStatus.PENDING && this.status !== PaymentStatus.PROCESSING) {
      throw new Error(`Cannot mark payment as failed from ${this.status}`);
    }

    this.status = PaymentStatus.FAILED;
    this.errorMessage = errorMessage;
  }
}
