import { DomainEvent } from './index';

export class ConnectorCommandIssuedEvent extends DomainEvent {
  constructor(
    public readonly commandId: string,
    public readonly connectorId: string,
    public readonly workspaceId: string,
    public readonly commandType: string,
    public readonly payloadJson: string,
    public readonly issuedAt: Date,
  ) {
    super();
  }
}

export class ConnectorResponseReceivedEvent extends DomainEvent {
  constructor(
    public readonly responseId: string,
    public readonly commandId: string,
    public readonly connectorId: string,
    public readonly responseCode: string,
    public readonly responseMessage: string | null,
    public readonly payloadJson: string | null,
    public readonly receivedAt: Date,
  ) {
    super();
  }
}

export class ConnectorHealthUpdatedEvent extends DomainEvent {
  constructor(
    public readonly healthId: string,
    public readonly connectorId: string,
    public readonly healthScore: number,
    public readonly activeTerminals: number,
    public readonly activeAccounts: number,
    public readonly recordedAt: Date,
  ) {
    super();
  }
}

export class ExecutionOrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly accountId: string,
    public readonly symbolId: string,
    public readonly decisionId: string | null,
    public readonly correlationId: string | null,
    public readonly orderType: string,
    public readonly side: string,
    public readonly size: number,
    public readonly requestedPrice: number | null,
    public readonly stopLoss: number | null,
    public readonly takeProfit: number | null,
    public readonly timestamp: Date,
  ) {
    super();
  }
}

export class ExecutionOrderCompletedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly accountId: string,
    public readonly executedPrice: number,
    public readonly connectorCommandId: string | null,
    public readonly timestamp: Date,
    // Backward compatible additions for Portfolio ledger:
    public readonly symbolId?: string,
    public readonly side?: string,
    public readonly size?: number,
    public readonly correlationId?: string | null,
  ) {
    super();
  }
}

export class ExecutionOrderFailedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly workspaceId: string,
    public readonly organizationId: string,
    public readonly accountId: string,
    public readonly failureReason: string,
    public readonly connectorCommandId: string | null,
    public readonly timestamp: Date,
    // Backward compatible additions:
    public readonly symbolId?: string,
    public readonly side?: string,
    public readonly size?: number,
    public readonly correlationId?: string | null,
  ) {
    super();
  }
}
