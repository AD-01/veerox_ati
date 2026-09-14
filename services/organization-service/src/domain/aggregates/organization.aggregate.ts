import { BaseAggregateRoot } from './base.aggregate';
import { OrganizationCreatedEvent, OrganizationUpdatedEvent, OrganizationArchivedEvent } from '@veerox/events';

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  timezone: string | null;
  currency: string | null;
  status: OrganizationStatus;
  createdAt: Date;
}

export class Organization extends BaseAggregateRoot {
  private props: OrganizationProps;

  private constructor(props: OrganizationProps) {
    super();
    this.props = props;
  }

  public static create(
    id: string,
    name: string,
    slug: string,
    ownerUserId: string,
    timezone?: string,
    currency?: string,
  ): Organization {
    const props: OrganizationProps = {
      id,
      name,
      slug,
      ownerUserId,
      subscriptionPlan: null,
      subscriptionStatus: null,
      timezone: timezone || null,
      currency: currency || null,
      status: OrganizationStatus.ACTIVE,
      createdAt: new Date(),
    };

    const org = new Organization(props);

    org.apply(
      new OrganizationCreatedEvent(
        org.props.id,
        org.props.name,
        org.props.ownerUserId,
        org.props.createdAt,
      ),
    );

    return org;
  }

  public static load(props: OrganizationProps): Organization {
    return new Organization(props);
  }

  public update(name?: string, timezone?: string, currency?: string): void {
    this.ensureActive();

    if (name) this.props.name = name;
    if (timezone) this.props.timezone = timezone;
    if (currency) this.props.currency = currency;

    this.apply(
      new OrganizationUpdatedEvent(this.props.id, new Date()),
    );
  }

  public archive(): void {
    if (this.props.status === OrganizationStatus.ARCHIVED) {
      return;
    }
    this.props.status = OrganizationStatus.ARCHIVED;

    this.apply(
      new OrganizationArchivedEvent(this.props.id, new Date()),
    );
  }

  public transferOwnership(newOwnerUserId: string): void {
    this.ensureActive();

    if (this.props.ownerUserId === newOwnerUserId) {
      throw new Error('New owner must be different from the current owner.');
    }
    
    this.props.ownerUserId = newOwnerUserId;

    this.apply(
      new OrganizationUpdatedEvent(this.props.id, new Date()),
    );
  }

  public updateMemberRole(targetUserId: string, newRole: string, actorUserId: string): void {
    this.ensureActive();
    this.apply(
      new OrganizationUpdatedEvent(this.props.id, new Date()),
    );
  }

  private ensureActive(): void {
    if (this.props.status !== OrganizationStatus.ACTIVE) {
      throw new Error('Organization is not ACTIVE');
    }
  }

  // Getters
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get slug(): string { return this.props.slug; }
  get ownerUserId(): string { return this.props.ownerUserId; }
  get subscriptionPlan(): string | null { return this.props.subscriptionPlan; }
  get subscriptionStatus(): string | null { return this.props.subscriptionStatus; }
  get timezone(): string | null { return this.props.timezone; }
  get currency(): string | null { return this.props.currency; }
  get status(): OrganizationStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
}
