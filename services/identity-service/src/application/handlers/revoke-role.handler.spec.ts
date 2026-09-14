/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { RevokeRoleHandler } from './revoke-role.handler';
import { RevokeRoleCommand } from '../commands/revoke-role.command';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import { IUserRepository } from '../ports/user.repository.interface';
import { IAuditRepository } from '../ports/audit.repository.interface';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleChangedEvent } from '@veerox/events';

describe('RevokeRoleHandler', () => {
  let handler: RevokeRoleHandler;
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
      userRole: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn(async (cb) => {
        const tx = {
          userRole: { delete: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        await cb(tx);
      }),
    };
    eventBus = {
      publish: jest.fn(),
    } as any;

    handler = new RevokeRoleHandler(userRepository, auditRepository, prismaService, eventBus);
  });

  it('should throw ForbiddenException if actor is revoking from themselves', async () => {
    await expect(
      handler.execute(new RevokeRoleCommand('user-1', 'role-1', 'user-1'))
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if actor has equal or lower authority', async () => {
    userRepository.findById.mockResolvedValue({ id: 'target-1' } as any);
    prismaService.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Platform Administrator' });
    prismaService.userRole.findUnique.mockResolvedValue({ userId: 'target-1', roleId: 'role-1', organizationId: null, workspaceId: null });
    prismaService.userRole.findMany.mockResolvedValue([
      { role: { name: 'Organization Administrator' }, organizationId: null, workspaceId: null }
    ]);

    await expect(
      handler.execute(new RevokeRoleCommand('target-1', 'role-1', 'actor-1'))
    ).rejects.toThrow('Cannot revoke a role with equal or greater authority');
  });
});
