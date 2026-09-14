import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetOrganizationQuery, ListOrganizationsQuery, GetMembersQuery, GetPendingInvitationsQuery, GetAuditLogsQuery } from './organization.queries';
import { PrismaService } from '@veerox/database';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuthorizationService } from '../../domain/services/authorization.service';

@QueryHandler(GetOrganizationQuery)
export class GetOrganizationHandler implements IQueryHandler<GetOrganizationQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetOrganizationQuery): Promise<unknown> {
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: query.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canReadOrganization(actorRoles, query.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: query.organizationId },
      include: {
        subscriptions: true,
      }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }
}

@QueryHandler(ListOrganizationsQuery)
export class ListOrganizationsHandler implements IQueryHandler<ListOrganizationsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListOrganizationsQuery): Promise<unknown> {
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: query.userId },
      include: { role: true },
    });

    const isPlatformAdmin = actorRoles.some(ur => ur.role.name === 'Platform Administrator');

    if (isPlatformAdmin) {
      return this.prisma.organization.findMany();
    }

    // Returns organizations the user is a member of
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId: query.userId },
      include: {
        organization: true,
      }
    });

    return memberships.map(m => m.organization);
  }
}

@QueryHandler(GetMembersQuery)
export class GetMembersHandler implements IQueryHandler<GetMembersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMembersQuery): Promise<unknown> {
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: query.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canReadOrganization(actorRoles, query.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: query.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return members;
  }
}

@QueryHandler(GetPendingInvitationsQuery)
export class GetPendingInvitationsHandler implements IQueryHandler<GetPendingInvitationsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPendingInvitationsQuery): Promise<unknown> {
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: query.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canManageOrganization(actorRoles, query.organizationId)) {
      // Typically only admins/managers can see pending invitations
      throw new ForbiddenException('Insufficient privileges');
    }

    const invitations = await this.prisma.invitation.findMany({
      where: { 
        organizationId: query.organizationId,
        acceptedAt: null,
      },
    });

    return invitations;
  }
}

@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsHandler implements IQueryHandler<GetAuditLogsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetAuditLogsQuery): Promise<unknown> {
    const actorRoles = await this.prisma.userRole.findMany({
      where: { userId: query.actorId },
      include: { role: true },
    });

    if (!AuthorizationService.canReadOrganization(actorRoles, query.organizationId)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    const where: any = {
      organizationId: query.organizationId,
    };

    if (query.filters?.action) {
      where.action = query.filters.action;
    }
    if (query.filters?.actorId) {
      where.actorId = query.filters.actorId;
    }
    if (query.filters?.targetEntityId) {
      where.targetEntityId = query.filters.targetEntityId;
    }
    if (query.filters?.startDate || query.filters?.endDate) {
      where.timestamp = {};
      if (query.filters?.startDate) where.timestamp.gte = new Date(query.filters.startDate);
      if (query.filters?.endDate) where.timestamp.lte = new Date(query.filters.endDate);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.filters?.limit || 50,
      skip: query.filters?.offset || 0,
    });

    return logs;
  }
}

