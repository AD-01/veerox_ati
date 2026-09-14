import { Test, TestingModule } from '@nestjs/testing';
import { AcceptInvitationHandler } from './accept-invitation.handler';
import { AcceptInvitationCommand } from '../commands/accept-invitation.command';
import { ORGANIZATION_REPOSITORY } from '../../domain/repositories/organization.repository.interface';
import { INVITATION_REPOSITORY } from '../../domain/repositories/invitation.repository.interface';
import { AUDIT_REPOSITORY } from '../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';
import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationStatus } from '../../domain/aggregates/organization.aggregate';

describe('AcceptInvitationHandler (Security Tests)', () => {
  let handler: AcceptInvitationHandler;
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
      findByToken: jest.fn(),
      save: jest.fn(),
    };
    mockAuditRepo = {
      log: jest.fn(),
    };
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => {
        if (Array.isArray(cb)) {
          return Promise.all(cb);
        }
        return cb(mockPrisma);
      }),
      organizationMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      }
    };
    mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptInvitationHandler,
        { provide: ORGANIZATION_REPOSITORY, useValue: mockOrgRepo },
        { provide: INVITATION_REPOSITORY, useValue: mockInvRepo },
        { provide: AUDIT_REPOSITORY, useValue: mockAuditRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<AcceptInvitationHandler>(AcceptInvitationHandler);
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
  };

  const mockOrg = {
    id: 'org-1',
    status: OrganizationStatus.ACTIVE,
  };

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);

  const validInvitation = {
    id: 'inv-1',
    organizationId: 'org-1',
    email: 'test@test.com',
    expiresAt: futureDate,
    acceptedAt: null,
  };

  it('ALLOWS Accept for Valid token + Correct user + Active org', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockInvRepo.findByToken.mockResolvedValue({ ...validInvitation });
    mockOrgRepo.findById.mockResolvedValue(mockOrg);
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-trader' });

    await expect(handler.execute(new AcceptInvitationCommand('valid-token', 'user-1')))
      .resolves.not.toThrow();
  });

  it('DENIES Accept for Expired Token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockInvRepo.findByToken.mockResolvedValue({
      ...validInvitation,
      expiresAt: pastDate,
    });

    await expect(handler.execute(new AcceptInvitationCommand('expired-token', 'user-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Accept for Reused (Already accepted) invitation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockInvRepo.findByToken.mockResolvedValue({
      ...validInvitation,
      acceptedAt: new Date(),
    });

    await expect(handler.execute(new AcceptInvitationCommand('used-token', 'user-1')))
      .rejects.toThrow(ConflictException);
  });

  it('DENIES Accept for Wrong User', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'other@test.com' });
    mockInvRepo.findByToken.mockResolvedValue({ ...validInvitation });

    await expect(handler.execute(new AcceptInvitationCommand('valid-token', 'user-2')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Accept for Archived Organization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockInvRepo.findByToken.mockResolvedValue({ ...validInvitation });
    mockOrgRepo.findById.mockResolvedValue({
      ...mockOrg,
      status: OrganizationStatus.ARCHIVED,
    });

    await expect(handler.execute(new AcceptInvitationCommand('valid-token', 'user-1')))
      .rejects.toThrow(ForbiddenException);
  });

  it('DENIES Accept for Invalid token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockInvRepo.findByToken.mockResolvedValue(null); // Not found

    await expect(handler.execute(new AcceptInvitationCommand('invalid-token', 'user-1')))
      .rejects.toThrow(NotFoundException);
  });
});
