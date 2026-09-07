import { User, UserStatus } from './user.aggregate';
import { Email } from '../value-objects/email.value-object';
import { PasswordHash } from '../value-objects/password-hash.value-object';
import { 
  UserRegisteredEvent, 
  UserSuspendedEvent,
  UserActivatedEvent,
  UserLockedEvent,
  UserUnlockedEvent,
  UserDeletedEvent
} from '@veerox/events/src/identity.events';

describe('User Aggregate', () => {
  it('should create a new user and publish UserRegisteredEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    
    const user = User.create(
      'uuid-123',
      email,
      'testuser',
      'John',
      'Doe',
      password,
    );

    expect(user.id).toBe('uuid-123');
    expect(user.email.value).toBe('test@example.com');
    expect(user.status).toBe(UserStatus.ACTIVE);

    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserRegisteredEvent);
    
    const registeredEvent = events[0] as UserRegisteredEvent;
    expect(registeredEvent.email).toBe('test@example.com');
  });

  it('should suspend user and publish UserSuspendedEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    
    const user = User.create(
      'uuid-123',
      email,
      'testuser',
      'John',
      'Doe',
      password,
    );
    user.commit(); // clear uncommitted events
    
    user.suspend();
    expect(user.status).toBe(UserStatus.SUSPENDED);
    
    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserSuspendedEvent);
  });

  it('should activate user and publish UserActivatedEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    const user = User.create('uuid-123', email, 'testuser', 'J', 'D', password);
    user.suspend();
    user.commit();

    user.activate();
    expect(user.status).toBe(UserStatus.ACTIVE);
    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserActivatedEvent);
  });

  it('should lock user and publish UserLockedEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    const user = User.create('uuid-123', email, 'testuser', 'J', 'D', password);
    user.commit();

    user.lock();
    expect(user.status).toBe(UserStatus.LOCKED);
    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserLockedEvent);
  });

  it('should unlock user and publish UserUnlockedEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    const user = User.create('uuid-123', email, 'testuser', 'J', 'D', password);
    user.lock();
    user.commit();

    user.unlock();
    expect(user.status).toBe(UserStatus.ACTIVE);
    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserUnlockedEvent);
  });

  it('should delete user and publish UserDeletedEvent', async () => {
    const email = Email.create('test@example.com');
    const password = await PasswordHash.hash('SecurePass123!');
    const user = User.create('uuid-123', email, 'testuser', 'J', 'D', password);
    user.commit();

    user.delete();
    expect(user.status).toBe(UserStatus.DELETED);
    const events = user.getUncommittedEvents();
    expect(events.length).toBe(1);
    expect(events[0]).toBeInstanceOf(UserDeletedEvent);
  });
});
