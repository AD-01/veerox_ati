export class GetWorkspaceQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
  ) {}
}

export class ListWorkspacesQuery {
  constructor(
    public readonly organizationId: string,
    public readonly allowedWorkspaceIds?: string[], // If undefined, implies full org access
  ) {}
}

export class ListWorkspaceMembersQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
  ) {}
}

export class GetWorkspaceMemberQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly organizationId: string,
  ) {}
}

export class GetWorkspaceAuditLogsQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly filters?: {
      action?: string;
      actorId?: string;
      targetEntityId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) {}
}
