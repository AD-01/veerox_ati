import { Test, TestingModule } from '@nestjs/testing';
import { GetOrganizationHandler, ListOrganizationsHandler, GetMembersHandler, GetPendingInvitationsHandler } from './organization.query-handlers';
import { GetOrganizationQuery, ListOrganizationsQuery, GetMembersQuery, GetPendingInvitationsQuery } from './organization.queries';
import { PrismaService } from '@veerox/database';
import { ForbiddenException } from '@nestjs/common';

describe('Organization Query Handlers (Security Tests)', () => {
  let prisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let getOrganizationHandler: GetOrganizationHandler;
  let listOrganizationsHandler: ListOrganizationsHandler;
  let getMembersHandler: GetMembersHandler;
  let getPendingInvitationsHandler: GetPendingInvitationsHandler;

  beforeEach(async () => {
    prisma = {
      userRole: {
        findMany: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      organizationMember: {
        findMany: jest.fn(),
      },
      invitation: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOrganizationHandler,
        ListOrganizationsHandler,
        GetMembersHandler,
        GetPendingInvitationsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    getOrganizationHandler = module.get<GetOrganizationHandler>(GetOrganizationHandler);
    listOrganizationsHandler = module.get<ListOrganizationsHandler>(ListOrganizationsHandler);
    getMembersHandler = module.get<GetMembersHandler>(GetMembersHandler);
    getPendingInvitationsHandler = module.get<GetPendingInvitationsHandler>(GetPendingInvitationsHandler);
  });

  describe('GetOrganizationHandler', () => {
    it('ALLOWS Query Organization A for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]);
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Org A' });

      await expect(getOrganizationHandler.execute(new GetOrganizationQuery('org-1', 'actor-1'))).resolves.toBeDefined();
    });

    it('DENIES Query Organization B for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]); // Has access to org-1
      await expect(getOrganizationHandler.execute(new GetOrganizationQuery('org-2', 'actor-1'))).rejects.toThrow(ForbiddenException); // Trying to access org-2
    });

    it('DENIES Query Organization A for Non-member', async () => {
      prisma.userRole.findMany.mockResolvedValue([]); // No roles
      await expect(getOrganizationHandler.execute(new GetOrganizationQuery('org-1', 'actor-1'))).rejects.toThrow(ForbiddenException);
    });

    it('ALLOWS Platform Admin to Query Organization A (Global Access)', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: null, role: { name: 'Platform Administrator' } }]); // Global admin
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Org A' });

      await expect(getOrganizationHandler.execute(new GetOrganizationQuery('org-1', 'actor-1'))).resolves.toBeDefined();
    });
  });

  describe('ListOrganizationsHandler', () => {
    it('ALLOWS Platform Admin global access', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: null, role: { name: 'Platform Administrator' } }]);
      prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]); // All orgs

      const result = await listOrganizationsHandler.execute(new ListOrganizationsQuery('actor-1'));
      expect(result).toHaveLength(2);
      expect(prisma.organization.findMany).toHaveBeenCalled();
    });

    it('Restricts standard user to only their memberships', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Trader' } }]);
      prisma.organizationMember.findMany.mockResolvedValue([{ organization: { id: 'org-1' } }]);

      const result = await listOrganizationsHandler.execute(new ListOrganizationsQuery('actor-1'));
      expect(result).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any)[0]).toEqual({ id: 'org-1' });
      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'actor-1' } }));
    });
  });

  describe('GetMembersHandler', () => {
    it('ALLOWS Query Organization A members for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]);
      prisma.organizationMember.findMany.mockResolvedValue([]);

      await expect(getMembersHandler.execute(new GetMembersQuery('org-1', 'actor-1'))).resolves.toBeDefined();
    });

    it('DENIES Query Organization B members for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]);
      await expect(getMembersHandler.execute(new GetMembersQuery('org-2', 'actor-1'))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GetPendingInvitationsHandler', () => {
    it('ALLOWS Query Organization A invitations for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]);
      prisma.invitation.findMany.mockResolvedValue([]);

      await expect(getPendingInvitationsHandler.execute(new GetPendingInvitationsQuery('org-1', 'actor-1'))).resolves.toBeDefined();
    });

    it('DENIES Query Organization B invitations for Organization A Admin', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ organizationId: 'org-1', role: { name: 'Organization Admin' } }]);
      await expect(getPendingInvitationsHandler.execute(new GetPendingInvitationsQuery('org-2', 'actor-1'))).rejects.toThrow(ForbiddenException);
    });
  });
});
