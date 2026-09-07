export class ProvisionConnectorCredentialCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}

export class RotateConnectorCredentialCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}

export class RevokeConnectorCredentialCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly actorId: string,
  ) {}
}
