export class OrganizationCreatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly ownerUserId: string,
    public readonly createdAt: Date,
  ) {}
}

export class OrganizationUpdatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly updatedAt: Date,
  ) {}
}

export class OrganizationArchivedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly archivedAt: Date,
  ) {}
}

export class MemberInvitedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly email: string,
    public readonly invitedBy: string,
  ) {}
}

export class MemberJoinedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly joinedAt: Date,
  ) {}
}

export class SubscriptionChangedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly planId: string,
    public readonly status: string,
  ) {}
}
