import { Test, TestingModule } from '@nestjs/testing';
import { TransferOrganizationOwnershipHandler } from './transfer-ownership.handler';
import { TransferOrganizationOwnershipCommand } from '../commands/transfer-ownership.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('TransferOrganizationOwnershipHandler (Security Tests)', () => {
  let handler: TransferOrganizationOwnershipHandler;
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
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      organization: {
        update: jest.fn(),
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
        TransferOrganizationOwnershipHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<TransferOrganizationOwnershipHandler>(TransferOrganizationOwnershipHandler);
  });

  const mockOrg = {
    id: 'org-1',
    status: OrganizationStatus.ACTIVE,
    ownerUserId: 'owner-1',
    transferOwnership: jest.fn(),
    getUncommittedEvents: jest.fn().mockReturnValue([]),
    commit: jest.fn(),
  };

  it('ALLOWS Valid transfer (Authorized current owner + Eligible member + Confirmation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([]);
    mockPrisma.organizationMember.findUnique.mockResolvedValue({ id: 'membership-2' }); // is member
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-admin' });
    mockPrisma.userRole.findUnique.mockResolvedValue(null); // Doesn't have role yet

    await expect(handler.execute(new TransferOrganizationOwnershipCommand('org-1', 'user-2', 'owner-1', 'CONFIRM')))
      .resolves.not.toThrow();
      
    // Atomicity check - ensure transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    // Audit check
    expect(mockAuditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TransferOwnership' }));
  });

  it('DENIES Unauthorized actor (Non-owner)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    // Actor is not the owner ('user-3'), and not a Platform Admin
    mockPrisma.userRole.findMany.mockResolvedValue([]);

    await expect(handler.execute(new TransferOrganizationOwnershipCommand('org-1', 'user-2', 'user-3', 'CONFIRM')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Non-member target', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([]);
    // Target user is not a member of the organization
    mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

    await expect(handler.execute(new TransferOrganizationOwnershipCommand('org-1', 'user-2', 'owner-1', 'CONFIRM')))
      .rejects.toThrow(ConflictException);
  });

  it('DENIES Invalid organization (Archived/Unavailable)', async () => {
    mockOrgRepo.findById.mockResolvedValue({
      ...mockOrg,
      status: OrganizationStatus.ARCHIVED,
    });

    await expect(handler.execute(new TransferOrganizationOwnershipCommand('org-1', 'user-2', 'owner-1', 'CONFIRM')))
      .rejects.toThrow(NotFoundException);
  });
});
