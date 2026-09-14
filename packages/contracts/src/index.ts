import { IsString, IsNumber, IsIn, IsOptional, Min } from 'class-validator';

export interface RiskUtilizationDto {
  accountId: string;
  workspaceId: string;
  timestamp: Date;
  drawdown: {
    current: number;
    limit: number;
    [key: string]: any; };
  margin: {
    currentUsed: number;
    currentEquity: number;
    limitThreshold: number;
    [key: string]: any; };
  dailyLoss: {
    limit: number;
    [key: string]: any; };
  exposure: {
    limit: number;
    [key: string]: any; };
  riskScore: number;
  decisionOutcome: string;
  [key: string]: any; }

export interface MarketQuoteDto {
  symbolId: string;
  brokerSymbol: string;
  standardSymbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
  [key: string]: any; }

export interface StrategyStatusDto {
  strategyId: string;
  name: string;
  status: string;
  isCurrent: boolean;
  updatedAt: Date;
  [key: string]: any; }

export class SubmitManualTradeRequestDto {
  @IsString()
  accountId!: string;

  @IsString()
  symbolId!: string;

  @IsIn(['BUY', 'SELL'])
  tradeDirection!: 'BUY' | 'SELL';

  @IsNumber()
  @Min(0.01)
  requestedSize!: number;

  @IsString()
  orderType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfit?: number;

  @IsOptional()
  @IsString()
  clientExecutionId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDeviation?: number;
}

export interface RiskAssessmentDto {
  decisionOutcome: string;
  riskScore: number;
  [key: string]: any; }

export interface EventEnvelope<T = unknown> {
  id: string;
  eventId?: string; // Add eventId
  name: string;
  eventType?: string; // Add eventType
  version: number;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  workspaceId?: string; // Add workspaceId
  organizationId?: string; // Add organizationId
  data: T;
  [key: string]: any; }

export interface TradingAccountDto {
  id: string;
  accountName?: string;
  accountNumber?: string;
  brokerName?: string;
  brokerServer?: string;
  terminalVersion?: string;
  platform?: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  marginUsed?: number;
  freeMargin: number;
  unrealizedPnl?: number;
  leverage?: number;
  status: string;
  synchronizationStatus?: string;
  tradingEnabled?: boolean;
  executionHalted?: boolean;
  [key: string]: any; }

export interface ExecutionOrderDto {
  id: string;
  symbol?: string;
  symbolId: string;
  side: 'BUY' | 'SELL';
  size: number;
  executedSize?: number;
  status: string;
  createdAt: string;
  orderType: string;
  requestedPrice?: number;
  filledPrice?: number;
  clientExecutionId: string;
  correlationId?: string;
  failureReason?: string;
  brokerTicketId?: string;
  [key: string]: any; }

export interface ExecutionReportAckDto {
  executionReportId: string;
  status: 'ACKNOWLEDGED' | 'REJECTED';
  reason?: string;
}

export interface PositionDto {
  id: string;
  symbol?: string;
  symbolId: string;
  side: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  quantity: number;
  averageEntryPrice: number;
  unrealizedPnl: number;
  status: string;
  brokerTicketId?: string;
  createdAt: string;
  [key: string]: any; }

export interface AccountHistoryPointDto {
  timestamp: string;
  equity: number;
  balance: number;
  [key: string]: any; }

export interface UserSessionDto {
  id: string;
  userId: string;
  email: string;
  roles: string[];
  workspaceId: string;
  [key: string]: any; }

export interface LicenseDto {
  id: string;
  key: string;
  status: string;
  expiresAt: string;
  productId?: string;
  organizationId?: string;
  licenseKey?: string;
  [key: string]: any; }

export interface MarketplaceProductDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  productType?: string;
  version?: string;
  averageRating?: number;
  reviewCount?: number;
  purchaseCount?: number;
  pricingModel?: string;
  status?: string;
  organizationId?: string;
  createdAt?: string;
  [key: string]: any; }

export interface SubscriptionDto {
  id: string;
  status: string;
  [key: string]: any; }

export interface InvoiceDto {
  id: string;
  amount: number;
  currency?: string;
  status?: string;
  [key: string]: any; }

export interface ConnectorDto {
  id: string;
  status: string;
  name?: string;
  provider?: string;
  connectionStatus?: string;
  healthRecords?: any[];
  lastSeenAt?: string;
  agentId?: string;
  [key: string]: any; }

export interface ConnectorCommandDto {
  id: string;
  commandType?: string;
  status?: string;
  sequenceNumber?: number;
  payloadJson?: string;
  createdAt?: string;
  updatedAt?: string;
  clientExecutionId?: string;
  [key: string]: any; }

export interface ProvisionConnectorResponseDto {
  id?: string;
  connectorId?: string;
  agentSecret?: string;
  agentId?: string;
  [key: string]: any;
}

export interface UsageRecordDto { [key: string]: any; }
export interface BillingLedgerSummaryDto { [key: string]: any; }
export interface ConnectorHealthDto { [key: string]: any; }
export interface ProductReviewDto { [key: string]: any; }

export interface OrganizationMemberDto {
  organizationId: string;
  userId: string;
  joinedAt: Date | string;
  status: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export interface WorkspaceConfigDto {
  workspaceId: string;
  tradingPolicies: string;
  riskLimits: string;
  notificationSettings: string;
  strategyPreferences: string;
  automationMode: string;
}

export interface WorkspaceDto {
  id: string;
  organizationId: string;
  name: string;
  portfolioMode: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  configuration?: WorkspaceConfigDto;
}

export interface AuditLogDto {
  id: string;
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  timestamp: Date | string;
  ipAddress?: string | null;
  device?: string | null;
  reason?: string | null;
  correlationId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  targetEntityId?: string | null;
  targetEntityType?: string | null;
}
