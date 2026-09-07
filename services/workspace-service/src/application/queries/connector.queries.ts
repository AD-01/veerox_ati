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
