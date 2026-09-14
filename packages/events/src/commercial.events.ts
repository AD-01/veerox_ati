import { DomainEvent } from './index';

export class CommercialEvent extends DomainEvent {
  public id?: string;
  public organizationId?: string;
  public workspaceId?: string;
  public productId?: string | null;
  public subscriptionId?: string;
  public correlationId?: string;
  public causationId?: string;
  public eventId?: string;
  public consumerId?: string;
  public invoiceId?: string;
  
  constructor() {
    super();
  }
}

export class LicenseIssuedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string,
    public readonly licenseId: string,
    public readonly licenseKey: string,
    public readonly correlationId?: string,
    public readonly causationId?: string
  ) { super(); }
}

export class LicenseActivatedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly licenseId: string,
    public readonly productId: string
  ) { super(); }
}

export class LicenseSuspendedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly licenseId: string,
    public readonly productId: string,
    public readonly reason: string
  ) { super(); }
}

export class LicenseRevokedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string,
    public readonly licenseId: string,
    public readonly reason: string
  ) { super(); }
}

export class LicenseExpiredEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly licenseId: string,
    public readonly productId: string
  ) { super(); }
}

export class ProductSubscriptionActivatedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly subscriptionId: string,
    public readonly productId: string,
    public readonly billingPeriod: string,
    public readonly correlationId?: string,
    public readonly causationId?: string
  ) { super(); }
}

export class ProductSubscriptionCanceledEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly subscriptionId: string,
    public readonly productId: string
  ) { super(); }
}

export class PurchaseCreatedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string,
    public readonly price: number,
    public readonly currency: string,
    public readonly subscriptionId: string,
    public readonly correlationId?: string,
    public readonly causationId?: string,
    public readonly idempotencyKey?: string
  ) { super(); }
}

export class InvoiceIssuedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly invoiceId: string,
    public readonly amount: number,
    public readonly currency: string
  ) { super(); }
}

export class InvoicePaidEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly invoiceId: string,
    public readonly paymentId: string
  ) { super(); }
}

export class UsageRecordedEvent extends CommercialEvent {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string | null,
    public readonly metricName: string,
    public readonly quantity: number,
    public readonly timestamp: Date
  ) { super(); }
}
