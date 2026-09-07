import { DomainEvent } from './index';

export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly registeredAt: Date,
  ) {
    super();
  }
}

export class UserActivatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly activatedAt: Date,
  ) {
    super();
  }
}

export class UserSuspendedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly suspendedAt: Date,
  ) {
    super();
  }
}

export class UserLockedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly lockedAt: Date,
  ) {
    super();
  }
}

export class UserUnlockedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly unlockedAt: Date,
  ) {
    super();
  }
}

export class UserDeletedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly deletedAt: Date,
  ) {
    super();
  }
}

export class UserRoleChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly oldRole: string,
    public readonly newRole: string,
    public readonly changedBy: string,
  ) {
    super();
  }
}
