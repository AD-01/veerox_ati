/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { SuspendUserHandler } from './suspend-user.handler';
import { SuspendUserCommand } from '../commands/suspend-user.command';
import { EventBus } from '@nestjs/cqrs';
import { IUserRepository } from '../ports/user.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { TokenService } from '../../infrastructure/auth/token.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserStatus } from '../../domain/aggregates/user.aggregate';

describe('SuspendUserHandler', () => {
  let handler: SuspendUserHandler;
  let userRepository: jest.Mocked<IUserRepository>;
  let auditRepository: jest.Mocked<IAuditRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      save: jest.fn(),
    };
    auditRepository = {
      log: jest.fn(),
    };
    tokenService = {
      revokeAllSessionsForUser: jest.fn(),
    } as any;
    eventBus = {
      publish: jest.fn(),
    } as any;

    handler = new SuspendUserHandler(userRepository, auditRepository, tokenService, eventBus);
  });

  it('should throw ForbiddenException if actor is suspending themselves', async () => {
    await expect(
      handler.execute(new SuspendUserCommand('user-1', 'reason', 'user-1'))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should suspend user, publish event, and log audit', async () => {
    const mockUser = {
      status: UserStatus.ACTIVE,
      suspend: jest.fn().mockImplementation(function(this: any) { this.status = UserStatus.SUSPENDED; }),
      getUncommittedEvents: jest.fn().mockReturnValue([{ name: 'UserSuspendedEvent' }]),
      commit: jest.fn(),
    } as any;
    
    userRepository.findById.mockResolvedValue(mockUser);

    await handler.execute(new SuspendUserCommand('target-1', 'Violation', 'actor-1'));

    expect(mockUser.suspend).toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledWith(mockUser);
    expect(auditRepository.log).toHaveBeenCalledWith({
      actorId: 'actor-1',
      targetUserId: 'target-1',
      action: 'SuspendUser',
      previousState: expect.any(String),
      newState: expect.any(String),
      reason: 'Violation',
    });
    expect(eventBus.publish).toHaveBeenCalledWith({ name: 'UserSuspendedEvent' });
    expect(mockUser.commit).toHaveBeenCalled();
    expect(tokenService.revokeAllSessionsForUser).toHaveBeenCalledWith('target-1');
  });
});
