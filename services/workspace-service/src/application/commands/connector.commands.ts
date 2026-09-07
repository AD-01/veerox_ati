export class CreateConnectorCommand {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly provider: string,
    public readonly actorId: string,
  ) {}
}

export class UpdateConnectorCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly actorId: string,
  ) {}
}

export class ArchiveConnectorCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}

export class IssueConnectorCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly commandType: string,
    public readonly payloadJson: string,
    public readonly actorId: string,
  ) {}
}
