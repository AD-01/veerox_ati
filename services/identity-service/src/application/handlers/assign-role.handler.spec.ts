/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { AssignRoleHandler } from './assign-role.handler';
import { AssignRoleCommand } from '../commands/assign-role.command';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { IUserRepository } from '../ports/user.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleChangedEvent } from '@veerox/events/src/identity.events';
import { User, UserStatus } from '../../domain/aggregates/user.aggregate';

describe('AssignRoleHandler', () => {
  let handler: AssignRoleHandler;
  let userRepository: jest.Mocked<IUserRepository>;
  let auditRepository: jest.Mocked<IAuditRepository>;
  let prismaService: any;
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
    prismaService = {
      role: { findUnique: jest.fn() },
      userRole: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (cb) => {
        const tx = {
          userRole: { create: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        await cb(tx);
      }),
    };
    eventBus = {
      publish: jest.fn(),
    } as any;

    handler = new AssignRoleHandler(userRepository, auditRepository, prismaService, eventBus);
  });

  it('should throw ForbiddenException if actor is assigning to themselves', async () => {
    await expect(
      handler.execute(new AssignRoleCommand('user-1', 'role-1', null, null, 'user-1'))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if actor has equal or lower authority', async () => {
    userRepository.findById.mockResolvedValue({ id: 'target-1' } as any);
    prismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Platform Administrator' });
    prismaService.userRole.findMany.mockResolvedValue([
      { role: { name: 'Organization Administrator' }, organizationId: null, workspaceId: null }
    ]);

    await expect(
      handler.execute(new AssignRoleCommand('target-1', 'role-1', null, null, 'actor-1'))
    ).rejects.toThrow('Cannot assign a role with equal or greater authority');
  });

  it('should throw ForbiddenException if actor is out of scope', async () => {
    userRepository.findById.mockResolvedValue({ id: 'target-1' } as any);
    prismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Trader' });
    prismaService.userRole.findMany.mockResolvedValue([
      { role: { name: 'Organization Administrator' }, organizationId: 'org-1', workspaceId: null }
    ]);

    await expect(
      handler.execute(new AssignRoleCommand('target-1', 'role-1', 'org-2', null, 'actor-1'))
    ).rejects.toThrow('Cannot assign a role outside of your authority scope');
  });

  it('should publish UserRoleChangedEvent on success', async () => {
    userRepository.findById.mockResolvedValue({ id: 'target-1' } as any);
    prismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Trader' });
    prismaService.userRole.findMany.mockResolvedValue([
      { role: { name: 'Platform Administrator' }, organizationId: null, workspaceId: null }
    ]);
    prismaService.userRole.findUnique.mockResolvedValue(null);

    await handler.execute(new AssignRoleCommand('target-1', 'role-1', null, null, 'actor-1'));

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(UserRoleChangedEvent)
    );
  });
});
