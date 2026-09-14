import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveOrganizationHandler } from './archive-organization.handler';
import { ArchiveOrganizationCommand } from '../commands/archive-organization.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('ArchiveOrganizationHandler (Security Tests)', () => {
  let handler: ArchiveOrganizationHandler;
  let mockOrgRepo: Record<string, jest.Mock>;
  let mockAuditRepo: Record<string, jest.Mock>;
  let mockPrisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockEventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      findById: jest.fn(),
      save: jest.fn(),
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
        updateMany: jest.fn(),
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
        ArchiveOrganizationHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<ArchiveOrganizationHandler>(ArchiveOrganizationHandler);
  });

  const mockOrg = {
    id: 'org-1',
    name: 'Test Org',
    status: OrganizationStatus.ACTIVE,
    archive: jest.fn(),
    getUncommittedEvents: jest.fn().mockReturnValue([]),
    commit: jest.fn(),
  };

  it('ALLOWS Archive for Organization Admin (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new ArchiveOrganizationCommand('org-1', 'actor-1'))).resolves.not.toThrow();
    
    // Ensure revocation was executed
    expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } });
    expect(mockPrisma.organizationMember.updateMany).toHaveBeenCalledWith({ 
      where: { organizationId: 'org-1' }, 
      data: { status: 'ARCHIVED' } 
    });
  });

  it('DENIES Archive for Admin of a DIFFERENT Organization (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    // User is an Org Admin, but for a different org
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-2', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new ArchiveOrganizationCommand('org-1', 'actor-1')))
      .rejects.toThrow(ForbiddenException);
  });
});
