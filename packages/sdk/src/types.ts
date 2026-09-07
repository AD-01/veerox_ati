export interface ConnectorClientConfig {
  /** Base URL for identity and workspace services (e.g. http://localhost:3000) */
  baseUrl: string;
  
  /** Connector ID */
  connectorId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Secret provisioned for this connector */
  clientSecret: string;
}

export interface HeartbeatHealthDto {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkLatency?: number;
  activeTerminals?: number;
  activeAccounts?: number;
  healthScore?: number;
}

export interface ConnectorHeartbeatDto {
  agentVersion?: string;
  health?: HeartbeatHealthDto;
}

export interface ConnectorCommandDto {
  id: string;
  connectorId: string;
  commandType: string;
  payloadJson: string;
  status: string;
  retries: number;
  createdAt: string;
  expiresAt?: string;
  processedAt?: string;
}

export interface CommandResponseDto {
  responseCode: string;
  responseMessage?: string;
  payloadJson?: string;
}

export type CommandHandler = (command: ConnectorCommandDto) => Promise<CommandResponseDto>;
