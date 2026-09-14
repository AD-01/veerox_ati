export class GetOrganizationQuery {
  constructor(public readonly organizationId: string, public readonly actorId: string) {}
}

export class ListOrganizationsQuery {
  constructor(public readonly userId: string) {}
}

export class GetMembersQuery {
  constructor(public readonly organizationId: string, public readonly actorId: string) {}
}

export class GetPendingInvitationsQuery {
  constructor(public readonly organizationId: string, public readonly actorId: string) {}
}

export class GetAuditLogsQuery {
  constructor(
    public readonly organizationId: string,
    public readonly actorId: string,
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
