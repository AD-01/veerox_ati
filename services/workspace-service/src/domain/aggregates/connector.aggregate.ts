import { BaseAggregateRoot } from './base.aggregate';
import {
  ConnectorCreatedEvent,
  ConnectorUpdatedEvent,
  ConnectorArchivedEvent,
  ConnectorConnectedEvent,
  ConnectorDisconnectedEvent,
  ConnectorHeartbeatReceivedEvent,
} from '@veerox/events';
import { ConnectorCommandIssuedEvent } from '@veerox/events';

export enum ConnectorStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ConnectorConnectionStatus {
  PROVISIONED = 'PROVISIONED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  REVOKED = 'REVOKED',
  DISABLED = 'DISABLED',
}

export interface ConnectorProps {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  provider: string;
  status: ConnectorStatus;
  connectionStatus: ConnectorConnectionStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export class Connector extends BaseAggregateRoot {
  private props: ConnectorProps;

  private constructor(props: ConnectorProps) {
    super();
    this.props = props;
  }

  public static create(
    id: string,
    organizationId: string,
    workspaceId: string,
    name: string,
    provider: string,
  ): Connector {
    const props: ConnectorProps = {
      id,
      organizationId,
      workspaceId,
      name,
      provider,
      status: ConnectorStatus.ACTIVE,
      connectionStatus: ConnectorConnectionStatus.PROVISIONED,
      lastSeenAt: null,
      createdAt: new Date(),
    };

    const connector = new Connector(props);
    connector.apply(
      new ConnectorCreatedEvent(
        props.id,
        props.organizationId,
        props.workspaceId,
        props.name,
        props.provider,
        props.status,
        props.createdAt,
      ),
    );

    return connector;
  }

  public static reconstitute(props: ConnectorProps): Connector {
    return new Connector(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get organizationId(): string {
    return this.props.organizationId;
  }
  public get workspaceId(): string {
    return this.props.workspaceId;
  }
  public get name(): string {
    return this.props.name;
  }
  public get provider(): string {
    return this.props.provider;
  }
  public get status(): ConnectorStatus {
    return this.props.status;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get connectionStatus(): ConnectorConnectionStatus {
    return this.props.connectionStatus;
  }
  public get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }

  public update(name?: string): void {
    if (this.props.status === ConnectorStatus.ARCHIVED) {
      throw new Error('Cannot update an archived connector');
    }

    const updates: Record<string, unknown> = {};
    if (name && name !== this.props.name) {
      this.props.name = name;
      updates.name = name;
    }

    if (Object.keys(updates).length > 0) {
      this.apply(
        new ConnectorUpdatedEvent(
          this.props.id,
          this.props.organizationId,
          this.props.workspaceId,
          updates,
          new Date(),
        ),
      );
    }
  }

  public archive(): void {
    if (this.props.status === ConnectorStatus.ARCHIVED) {
      return;
    }

    this.props.status = ConnectorStatus.ARCHIVED;
    this.apply(
      new ConnectorArchivedEvent(
        this.props.id,
        this.props.organizationId,
        this.props.workspaceId,
        new Date(),
      ),
    );
  }

  public issueCommand(commandId: string, commandType: string, payloadJson: string): void {
    if (this.props.status !== ConnectorStatus.ACTIVE) {
      throw new Error('Cannot issue command to a non-active connector');
    }
    
    if (this.props.connectionStatus === ConnectorConnectionStatus.REVOKED) {
      throw new Error('Cannot issue command to a revoked connector');
    }

    this.apply(
      new ConnectorCommandIssuedEvent(
        commandId,
        this.props.id,
        this.props.workspaceId,
        commandType,
        payloadJson,
        new Date(),
        new Date(Date.now() + 30 * 1000), // Default 30s expiration
      ),
    );
  }

  public heartbeat(agentVersion: string | null): void {
    if (this.props.status === ConnectorStatus.ARCHIVED) {
      throw new Error('Cannot process heartbeat for an archived connector');
    }

    if (
      this.props.connectionStatus === ConnectorConnectionStatus.REVOKED ||
      this.props.connectionStatus === ConnectorConnectionStatus.DISABLED
    ) {
      throw new Error(`Cannot connect a connector in state: ${this.props.connectionStatus}`);
    }

    const now = new Date();
    const isNewConnection = this.props.connectionStatus !== ConnectorConnectionStatus.CONNECTED;

    this.props.connectionStatus = ConnectorConnectionStatus.CONNECTED;
    this.props.lastSeenAt = now;

    this.apply(
      new ConnectorHeartbeatReceivedEvent(
        this.props.id,
        this.props.workspaceId,
        this.props.organizationId,
        now,
      ),
    );

    if (isNewConnection) {
      this.apply(
        new ConnectorConnectedEvent(
          this.props.id,
          this.props.workspaceId,
          this.props.organizationId,
          agentVersion,
          now,
        ),
      );
    }
  }

  public disconnect(reason: string): void {
    if (
      this.props.connectionStatus !== ConnectorConnectionStatus.CONNECTED &&
      this.props.connectionStatus !== ConnectorConnectionStatus.CONNECTING
    ) {
      return;
    }

    this.props.connectionStatus = ConnectorConnectionStatus.DISCONNECTED;
    this.apply(
      new ConnectorDisconnectedEvent(
        this.props.id,
        this.props.workspaceId,
        this.props.organizationId,
        reason,
        new Date(),
      ),
    );
  }

  public revoke(): void {
    if (this.props.connectionStatus === ConnectorConnectionStatus.REVOKED) {
      return;
    }

    this.props.connectionStatus = ConnectorConnectionStatus.REVOKED;
    // ConnectorCredentialRevokedEvent is already handled at the credential level,
    // but the aggregate state is updated here.
  }
}
