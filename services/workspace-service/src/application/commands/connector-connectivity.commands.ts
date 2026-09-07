export class ReceiveConnectorHeartbeatCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly payload: {
      timestamp: Date;
      agentVersion: string | null;
      health?: {
        cpuUsage?: number;
        memoryUsage?: number;
        diskUsage?: number;
        networkLatency?: number;
        activeTerminals?: number;
        activeAccounts?: number;
        healthScore?: number;
      };
    },
  ) {}
}

export class ClaimPendingCommandCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
  ) {}
}

export class SubmitCommandResponseCommand {
  constructor(
    public readonly connectorId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly commandId: string,
    public readonly payload: {
      responseCode: string;
      responseMessage: string | null;
      payloadJson: string | null;
    },
  ) {}
}

export class CheckStaleConnectorsCommand {
  constructor(
    public readonly timeoutSeconds: number = 300, // 5 minutes default
  ) {}
}
