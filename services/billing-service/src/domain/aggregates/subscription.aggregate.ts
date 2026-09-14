import { BaseAggregateRoot } from './base.aggregate';
import { ProductSubscriptionActivatedEvent, ProductSubscriptionCanceledEvent } from '@veerox/events';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  PAST_DUE = 'PAST_DUE'
}

export class Subscription extends BaseAggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly productId: string,
    public status: SubscriptionStatus,
    public readonly billingPeriod: string,
    public nextBillingDate: Date | null,
    public idempotencyKey: string | null
  ) {
    super();
  }

  static create(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    productId: string;
    billingPeriod: string;
    idempotencyKey?: string;
  }): Subscription {
    return new Subscription(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.productId,
      SubscriptionStatus.PENDING,
      props.billingPeriod,
      null,
      props.idempotencyKey || null
    );
  }

  static restore(props: {
    id: string;
    organizationId: string;
    workspaceId: string;
    productId: string;
    status: string;
    billingPeriod: string;
    nextBillingDate: Date | null;
    idempotencyKey: string | null;
  }): Subscription {
    return new Subscription(
      props.id,
      props.organizationId,
      props.workspaceId,
      props.productId,
      props.status as SubscriptionStatus,
      props.billingPeriod,
      props.nextBillingDate,
      props.idempotencyKey
    );
  }

  activate(nextBillingDate: Date, correlationId?: string, causationId?: string): void {
    if (this.status !== SubscriptionStatus.PENDING && this.status !== SubscriptionStatus.SUSPENDED) {
      throw new Error(`Invalid transition: Cannot activate subscription from ${this.status}`);
    }

    this.status = SubscriptionStatus.ACTIVE;
    this.nextBillingDate = nextBillingDate;

    this.apply(
      new ProductSubscriptionActivatedEvent(
        crypto.randomUUID(),
        this.organizationId,
        this.workspaceId,
        this.id,
        this.productId,
        this.billingPeriod,
        correlationId,
        causationId
      )
    );
  }

  renew(nextBillingDate: Date): void {
    if (this.status !== SubscriptionStatus.ACTIVE && this.status !== SubscriptionStatus.PAST_DUE) {
      throw new Error(`Invalid transition: Cannot renew subscription from ${this.status}`);
    }

    this.status = SubscriptionStatus.ACTIVE;
    this.nextBillingDate = nextBillingDate;
  }

  cancel(): void {
    if (this.status !== SubscriptionStatus.ACTIVE && this.status !== SubscriptionStatus.PAST_DUE && this.status !== SubscriptionStatus.SUSPENDED) {
      throw new Error(`Invalid transition: Cannot cancel subscription from ${this.status}`);
    }

    this.status = SubscriptionStatus.CANCELED;

    this.apply(
      new ProductSubscriptionCanceledEvent(
        crypto.randomUUID(),
        this.organizationId,
        this.workspaceId,
        this.id,
        this.productId
      )
    );
  }

  suspend(): void {
    if (this.status !== SubscriptionStatus.ACTIVE && this.status !== SubscriptionStatus.PAST_DUE) {
      throw new Error(`Invalid transition: Cannot suspend subscription from ${this.status}`);
    }

    this.status = SubscriptionStatus.SUSPENDED;
  }

  expire(): void {
    if (this.status !== SubscriptionStatus.ACTIVE && this.status !== SubscriptionStatus.PAST_DUE && this.status !== SubscriptionStatus.SUSPENDED) {
      throw new Error(`Invalid transition: Cannot expire subscription from ${this.status}`);
    }

    this.status = SubscriptionStatus.EXPIRED;
  }
}
