import { Test, TestingModule } from '@nestjs/testing';
import { InviteMemberHandler, INVITATION_REPOSITORY } from './invite-member.handler';
import { InviteMemberCommand } from '../commands/invite-member.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('InviteMemberHandler (Security Tests)', () => {
  let handler: InviteMemberHandler;
  let mockOrgRepo: Record<string, jest.Mock>;
  let mockInvRepo: Record<string, jest.Mock>;
  let mockAuditRepo: Record<string, jest.Mock>;
  let mockPrisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockEventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      findById: jest.fn(),
    };
    mockInvRepo = {
      save: jest.fn(),
    };
    mockAuditRepo = {
      log: jest.fn(),
    };
    mockPrisma = {
      userRole: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      }
    };
    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: INVITATION_REPOSITORY, useValue: mockInvRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<InviteMemberHandler>(InviteMemberHandler);
  });

  const mockOrg = {
    id: 'org-1',
    status: OrganizationStatus.ACTIVE,
  };

  it('ALLOWS Invite for Organization Admin (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: { name: 'Organization Admin' } }
    ]);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(new InviteMemberCommand('org-1', 'test@test.com', 'actor-1')))
      .resolves.toBeDefined();
  });

  it('DENIES Invite for Admin of a DIFFERENT Organization (Tenant Isolation)', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([
      { organizationId: 'org-2', role: { name: 'Organization Admin' } }
    ]);

    await expect(handler.execute(new InviteMemberCommand('org-1', 'test@test.com', 'actor-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Invite for Non-member', async () => {
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.userRole.findMany.mockResolvedValue([]);

    await expect(handler.execute(new InviteMemberCommand('org-1', 'test@test.com', 'actor-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Invite when Organization is ARCHIVED', async () => {
    mockOrgRepo.findById.mockResolvedValue({
      ...mockOrg,
      status: OrganizationStatus.ARCHIVED,
    });

    await expect(handler.execute(new InviteMemberCommand('org-1', 'test@test.com', 'actor-1')))
      .rejects.toThrow(ConflictException);
  });
});
