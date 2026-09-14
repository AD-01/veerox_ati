import { Test, TestingModule } from '@nestjs/testing';
import { RemoveMemberHandler } from './remove-member.handler';
import { RemoveMemberCommand } from '../commands/remove-member.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('RemoveMemberHandler (Security Tests)', () => {
  let handler: RemoveMemberHandler;
  let mockOrgRepo: Record<string, jest.Mock>;
  let mockAuditRepo: Record<string, jest.Mock>;
  let mockPrisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockEventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      findById: jest.fn(),
    };
    mockAuditRepo = {
      log: jest.fn(),
    };
    mockPrisma = {
      userRole: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => {
        if (Array.isArray(cb)) {
          return Promise.all(cb);
        }
        return cb(mockPrisma);
      }),
    };
    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveMemberHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<RemoveMemberHandler>(RemoveMemberHandler);
  });

  const mockOrg = {
    id: 'org-1',
    status: OrganizationStatus.ACTIVE,
    ownerUserId: 'owner-1',
  };

  it('ALLOWS Remove for Organization Admin (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);
    mockPrisma.organizationMember.findUnique.mockResolvedValue({ id: 'membership-1' });

    await expect(handler.execute(new RemoveMemberCommand('org-1', 'user-2', 'actor-1')))
      .resolves.not.toThrow();
  });

  it('DENIES Remove for Admin of a DIFFERENT Organization (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-2', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new RemoveMemberCommand('org-1', 'user-2', 'actor-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Remove for Unauthorized Actor', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Trader' } } // Not an Admin
    ]);

    await expect(handler.execute(new RemoveMemberCommand('org-1', 'user-2', 'actor-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Remove of Protected Owner', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);
    mockPrisma.organizationMember.findUnique.mockResolvedValue({ id: 'membership-1' });

    // Attempting to remove the owner ('owner-1')
    await expect(handler.execute(new RemoveMemberCommand('org-1', 'owner-1', 'actor-1')))
      .rejects.toThrow(ConflictException);
  });
});
