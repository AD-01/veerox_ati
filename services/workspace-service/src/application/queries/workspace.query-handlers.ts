import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetWorkspaceQuery, ListWorkspacesQuery, ListWorkspaceMembersQuery, GetWorkspaceMemberQuery } from './workspace.queries';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { NotFoundException } from '@nestjs/common';

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler implements IQueryHandler<GetWorkspaceQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspaceQuery): Promise<unknown> {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: query.workspaceId,
      },
      include: {
        configuration: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.organizationId !== query.organizationId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    return workspace;
  }
}

@QueryHandler(ListWorkspacesQuery)
export class ListWorkspacesHandler implements IQueryHandler<ListWorkspacesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWorkspacesQuery): Promise<unknown[]> {
    const whereClause: Record<string, unknown> = {
      organizationId: query.organizationId,
    };

    if (query.allowedWorkspaceIds) {
      whereClause.id = { in: query.allowedWorkspaceIds };
    }

    const workspaces = await this.prisma.workspace.findMany({
      where: whereClause,
      include: {
        configuration: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return workspaces;
  }
}

@QueryHandler(ListWorkspaceMembersQuery)
export class ListWorkspaceMembersHandler implements IQueryHandler<ListWorkspaceMembersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWorkspaceMembersQuery): Promise<unknown[]> {
    // Verify workspace exists and belongs to org
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: query.workspaceId }
    });

    if (!workspace || workspace.organizationId !== query.organizationId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: query.workspaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return members;
  }
}

@QueryHandler(GetWorkspaceMemberQuery)
export class GetWorkspaceMemberHandler implements IQueryHandler<GetWorkspaceMemberQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetWorkspaceMemberQuery): Promise<unknown> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: query.workspaceId }
    });

    if (!workspace || workspace.organizationId !== query.organizationId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: query.workspaceId,
          userId: query.userId,
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    return member;
  }
}
