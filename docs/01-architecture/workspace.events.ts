import { DomainEvent } from '../../packages/events/src/index';

export class WorkspaceCreatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {
    super();
  }
}

export class WorkspaceUpdatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceArchivedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly archivedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceSettingsChangedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly settings: Record<string, unknown>,
    public readonly changedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceMemberAddedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly addedBy: string,
    public readonly addedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceMemberRemovedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly removedBy: string,
    public readonly removedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceRestoredEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly restoredAt: Date,
  ) {
    super();
  }
}

export class WorkspaceDeletedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly deletedAt: Date,
  ) {
    super();
  }
}

export class WorkspaceMemberRoleUpdatedEvent extends DomainEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly updatedBy: string,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}
