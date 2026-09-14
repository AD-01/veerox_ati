import { BaseAggregateRoot } from './base.aggregate';
import { Email } from '../value-objects/email.value-object';
import { PasswordHash } from '../value-objects/password-hash.value-object';
import {
  UserRegisteredEvent,
  UserActivatedEvent,
  UserSuspendedEvent,
  UserLockedEvent,
  UserUnlockedEvent,
  UserDeletedEvent,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  UserRoleChangedEvent,
} from '@veerox/events';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
  DELETED = 'DELETED',
}

export interface UserProps {
  id: string;
  email: Email;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: PasswordHash;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends BaseAggregateRoot {
  private props: UserProps;

  private constructor(props: UserProps) {
    super();
    this.props = props;
  }

  public static create(
    id: string,
    email: Email,
    username: string,
    firstName: string,
    lastName: string,
    passwordHash: PasswordHash,
  ): User {
    const props: UserProps = {
      id,
      email,
      username,
      firstName,
      lastName,
      passwordHash,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = new User(props);

    user.apply(
      new UserRegisteredEvent(
        user.props.id,
        user.props.email.value,
        `${user.props.firstName} ${user.props.lastName}`,
        user.props.createdAt,
      ),
    );

    return user;
  }

  public static load(props: UserProps): User {
    return new User(props);
  }

  public suspend(): void {
    if (this.props.status === UserStatus.DELETED) {
      throw new Error('Cannot transition from DELETED');
    }
    if (this.props.status === UserStatus.LOCKED) {
      throw new Error('Cannot suspend a LOCKED user directly');
    }
    if (this.props.status === UserStatus.SUSPENDED) {
      return;
    }
    this.props.status = UserStatus.SUSPENDED;
    this.props.updatedAt = new Date();
    this.apply(new UserSuspendedEvent(this.props.id, this.props.updatedAt));
  }

  public activate(): void {
    if (this.props.status === UserStatus.DELETED) {
      throw new Error('Cannot transition from DELETED');
    }
    if (this.props.status === UserStatus.ACTIVE) {
      return;
    }
    this.props.status = UserStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.apply(new UserActivatedEvent(this.props.id, this.props.updatedAt));
  }

  public lock(): void {
    if (this.props.status === UserStatus.DELETED) {
      throw new Error('Cannot transition from DELETED');
    }
    if (this.props.status === UserStatus.SUSPENDED) {
      throw new Error('Cannot lock a SUSPENDED user directly');
    }
    if (this.props.status === UserStatus.LOCKED) {
      return;
    }
    this.props.status = UserStatus.LOCKED;
    this.props.updatedAt = new Date();
    this.apply(new UserLockedEvent(this.props.id, this.props.updatedAt));
  }

  public unlock(): void {
    if (this.props.status === UserStatus.DELETED) {
      throw new Error('Cannot transition from DELETED');
    }
    if (this.props.status !== UserStatus.LOCKED) {
      throw new Error('User is not LOCKED');
    }
    this.props.status = UserStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.apply(new UserUnlockedEvent(this.props.id, this.props.updatedAt));
  }

  public delete(): void {
    if (this.props.status === UserStatus.DELETED) {
      return;
    }
    this.props.status = UserStatus.DELETED;
    this.props.updatedAt = new Date();
    this.apply(new UserDeletedEvent(this.props.id, this.props.updatedAt));
  }

  // Getters
  get id(): string {
    return this.props.id;
  }
  get email(): Email {
    return this.props.email;
  }
  get username(): string {
    return this.props.username;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
