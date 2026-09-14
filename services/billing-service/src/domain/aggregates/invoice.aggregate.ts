import { BaseAggregateRoot } from './base.aggregate';
import { InvoiceIssuedEvent, InvoicePaidEvent } from '@veerox/events';
import { Decimal } from 'decimal.js';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAST_DUE = 'PAST_DUE',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  VOID = 'VOID',
  FAILED = 'FAILED'
}

export class InvoiceLine {
  constructor(
    public readonly id: string,
    public readonly description: string,
    public readonly amount: Decimal
  ) {}
}

export class Invoice extends BaseAggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly subscriptionId: string | null,
    public amount: Decimal,
    public readonly currency: string,
    public status: InvoiceStatus,
    public lines: InvoiceLine[],
    public issuedAt: Date,
    public paidAt: Date | null,
    public idempotencyKey: string | null
  ) {
    super();
  }

  static create(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    subscriptionId: string | null;
    currency: string;
    idempotencyKey?: string;
  }): Invoice {
    return new Invoice(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.subscriptionId,
      new Decimal(0),
      props.currency,
      InvoiceStatus.DRAFT,
      [],
      new Date(),
      null,
      props.idempotencyKey || null
    );
  }

  static restore(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    subscriptionId: string | null;
    amount: Decimal;
    currency: string;
    status: string;
    lines: InvoiceLine[];
    issuedAt: Date;
    paidAt: Date | null;
    idempotencyKey: string | null;
  }): Invoice {
    return new Invoice(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.subscriptionId,
      props.amount,
      props.currency,
      props.status as InvoiceStatus,
      props.lines,
      props.issuedAt,
      props.paidAt,
      props.idempotencyKey
    );
  }

  addLine(id: string, description: string, amount: Decimal): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot add line to invoice in ${this.status} state`);
    }

    this.lines.push(new InvoiceLine(id, description, amount));
    this.recalculateTotal();
  }

  private recalculateTotal(): void {
    this.amount = this.lines.reduce((total, line) => total.plus(line.amount), new Decimal(0));
  }

  issue(): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Invalid transition: Cannot issue invoice from ${this.status}`);
    }

    if (this.lines.length === 0) {
      throw new Error('Cannot issue an invoice with no lines');
    }

    this.status = InvoiceStatus.ISSUED;
    this.issuedAt = new Date();

    this.apply(
      new InvoiceIssuedEvent(
        crypto.randomUUID(),
        this.organizationId,
        this.workspaceId,
        this.id,
        this.amount.toNumber(), // NOTE: Events usually carry number or string. 
        this.currency
      )
    );
  }

  markAsProcessing(): void {
    if (this.status !== InvoiceStatus.ISSUED && this.status !== InvoiceStatus.PAST_DUE) {
      throw new Error(`Invalid transition: Cannot process invoice from ${this.status}`);
    }
    this.status = InvoiceStatus.PROCESSING;
  }

  revertProcessing(): void {
    if (this.status !== InvoiceStatus.PROCESSING) {
      throw new Error(`Invalid transition: Cannot revert processing from ${this.status}`);
    }
    this.status = InvoiceStatus.ISSUED; // simplified, past due logic can be handled separately if needed
  }

  markAsPaid(paymentId: string): void {
    if (this.status !== InvoiceStatus.ISSUED && this.status !== InvoiceStatus.PAST_DUE && this.status !== InvoiceStatus.PROCESSING) {
      throw new Error(`Invalid transition: Cannot pay invoice from ${this.status}`);
    }

    this.status = InvoiceStatus.PAID;
    this.paidAt = new Date();

    this.apply(
      new InvoicePaidEvent(
        crypto.randomUUID(),
        this.organizationId,
        this.workspaceId,
        this.id,
        paymentId
      )
    );
  }

  markAsFailed(): void {
    if (this.status !== InvoiceStatus.ISSUED) {
      throw new Error(`Invalid transition: Cannot fail invoice from ${this.status}`);
    }
    this.status = InvoiceStatus.FAILED;
  }

  void(): void {
    if (this.status !== InvoiceStatus.ISSUED && this.status !== InvoiceStatus.FAILED && this.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Invalid transition: Cannot void invoice from ${this.status}`);
    }

    this.status = InvoiceStatus.VOID;
  }
}
