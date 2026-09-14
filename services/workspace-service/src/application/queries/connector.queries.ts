export class GetConnectorQuery {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}

export class ListConnectorsQuery {
  constructor(
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}

export class GetConnectorHealthHistoryQuery {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly from: Date,
    public readonly to: Date,
    public readonly limit: number,
  ) {}
}

export class GetConnectorCommandsQuery {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly limit: number,
  ) {}
}
