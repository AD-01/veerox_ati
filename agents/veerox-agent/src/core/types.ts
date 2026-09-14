export interface AuthChallenge {
  nonce: string;
  timestamp: string;
}

export interface AuthResponse {
  agentId: string;
  signature: string; // HMAC(nonce + timestamp + agentId, secret)
  tradingAccountId: string;
}

export interface ProtocolNegotiation {
  supportedProtocolVersions: string[];
  capabilities: string[];
}

export interface TradeExecutePayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  sl?: number;
  tp?: number;
  clientExecutionId: string;
  deviation?: number;
}

export interface CommandEnvelope {
  messageId: string;
  commandId: string;
  commandType: 'TRADE_EXECUTE' | 'CLOSE' | 'MODIFY' | 'RECONCILE' | 'HEARTBEAT' | 'RECOVERY';
  protocolVersion: string;
  agentId: string;
  organizationId: string;
  workspaceId: string;
  tradingAccountId: string;
  connectorId: string;
  accountSequence: number;
  correlationId: string;
  timestamp: string;
  expiresAt?: string;
  payload: TradeExecutePayload | Record<string, unknown>;
}

export interface CommandAck {
  ackId: string;
  commandId: string;
  status: 'COMMAND_RECEIVED' | 'COMMAND_ACCEPTED' | 'COMMAND_REJECTED';
  reason?: string;
}

export interface ExecutionReportAck {
  executionReportId: string;
  status: 'ACKNOWLEDGED' | 'REJECTED';
  reason?: string;
}

export interface ExecutionReport {
  executionReportId: string;
  commandId: string;
  clientExecutionId: string;
  brokerTicketId: string;
  brokerOrderId: string | null;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'FAILED' | 'ACKNOWLEDGED';
  symbol: string;
  side: 'BUY' | 'SELL';
  requestedSize: number;
  executedSize: number;
  remainingSize: number;
  executedPrice: number;
  commission: number;
  swap: number;
  realizedPnl: number;
  timestamp: string;
  origin: 'VEEROX' | 'MANUAL' | 'EXTERNAL_EA' | 'UNKNOWN';
}

export interface Heartbeat {
  agentId: string;
  timestamp: string;
  terminalStatus: 'CONNECTED' | 'DISCONNECTED';
  executionCapability: boolean;
}
