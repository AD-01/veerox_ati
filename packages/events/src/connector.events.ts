import { DomainEvent } from './index';

export class ConnectorCreatedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly provider: string,
    public readonly status: string,
    public readonly createdAt: Date,
  ) {
    super();
  }
}

export class ConnectorUpdatedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly updates: Record<string, unknown>,
    public readonly updatedAt: Date,
  ) {
    super();
  }
}

export class ConnectorArchivedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly archivedAt: Date,
  ) {
    super();
  }
}

export class ConnectorCredentialProvisionedEvent extends DomainEvent {
  constructor(
    public readonly credentialId: string,
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorCredentialRotatedEvent extends DomainEvent {
  constructor(
    public readonly oldCredentialId: string,
    public readonly newCredentialId: string,
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorCredentialRevokedEvent extends DomainEvent {
  constructor(
    public readonly credentialId: string,
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorAuthenticatedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly ipAddress: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorConnectedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly agentVersion: string | null,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorDisconnectedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ConnectorHeartbeatReceivedEvent extends DomainEvent {
  constructor(
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly timestamp: Date,
  ) {
    super();
  }
}
