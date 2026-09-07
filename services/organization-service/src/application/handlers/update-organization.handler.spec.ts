import { Test, TestingModule } from '@nestjs/testing';
import { UpdateOrganizationHandler } from './update-organization.handler';
import { UpdateOrganizationCommand } from '../commands/update-organization.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('UpdateOrganizationHandler (Security Tests)', () => {
  let handler: UpdateOrganizationHandler;
  let mockOrgRepo: Record<string, jest.Mock>;
  let mockAuditRepo: Record<string, jest.Mock>;
  let mockPrisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockEventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
    };
    mockAuditRepo = {
      log: jest.fn(),
    };
    mockPrisma = {
      userRole: {
        findMany: jest.fn(),
      },
    };
    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateOrganizationHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<UpdateOrganizationHandler>(UpdateOrganizationHandler);
  });

  const mockOrg = {
    id: 'org-1',
    name: 'Test Org',
    status: OrganizationStatus.ACTIVE,
    update: jest.fn(),
    getUncommittedEvents: jest.fn().mockReturnValue([]),
    commit: jest.fn(),
  };

  it('ALLOWS Update for Organization Admin (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new UpdateOrganizationCommand('org-1', 'actor-1', 'New Name'))).resolves.not.toThrow();
    expect(mockOrg.update).toHaveBeenCalledWith('New Name', undefined, undefined);
  });

  it('ALLOWS Update for Platform Admin (Global Access)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    // User is not in this org, but is a global Platform Admin
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: null, role: { name: 'Platform Administrator' } }
    ]);

    await expect(handler.execute(new UpdateOrganizationCommand('org-1', 'actor-1', 'New Name'))).resolves.not.toThrow();
  });

  it('DENIES Update for Admin of a DIFFERENT Organization (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    // User is an Org Admin, but for a different org
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-2', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new UpdateOrganizationCommand('org-1', 'actor-1', 'New Name')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Update for Non-member', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    // User has no roles
    mockPrisma.userRole.findMany.mockResolvedValue([]);

    await expect(handler.execute(new UpdateOrganizationCommand('org-1', 'actor-1', 'New Name')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Update when Organization is ARCHIVED (Archived State)', async () => {
    mockOrgRepo.findById.mockResolvedValue({
      ...mockOrg,
      status: OrganizationStatus.ARCHIVED,
    });
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new UpdateOrganizationCommand('org-1', 'actor-1', 'New Name')))
      .rejects.toThrow(ForbiddenException);
  });
});
