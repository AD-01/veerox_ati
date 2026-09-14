import { BaseAggregateRoot } from './base.aggregate';
import {
  TradingAccountCreatedEvent,
  TradingAccountUpdatedEvent,
  TradingAccountArchivedEvent,
  TradingAccountDeletedEvent,
  AccountStatisticsUpdatedEvent,
} from '@veerox/events';

export enum TradingAccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export interface TradingAccountProps {
  id: string;
  organizationId: string;
  workspaceId: string;
  connectorId: string;
  brokerName: string;
  brokerServer: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  leverage: string;
  currency: string;
  platform: string;
  terminalVersion: string;
  tradingEnabled: boolean;
  synchronizationStatus: string;
  status: TradingAccountStatus;
  lastSyncAt: Date | null;
  createdAt: Date;
}

export class TradingAccount extends BaseAggregateRoot {
  private props: TradingAccountProps;

  private constructor(props: TradingAccountProps) {
    super();
    this.props = props;
  }

  public static create(
    id: string,
    organizationId: string,
    workspaceId: string,
    connectorId: string,
    brokerName: string,
    brokerServer: string,
    accountNumber: string,
    accountName: string,
    accountType: string,
    leverage: string,
    currency: string,
    platform: string,
    terminalVersion: string,
  ): TradingAccount {
    const props: TradingAccountProps = {
      id,
      organizationId,
      workspaceId,
      connectorId,
      brokerName,
      brokerServer,
      accountNumber,
      accountName,
      accountType,
      leverage,
      currency,
      platform,
      terminalVersion,
      tradingEnabled: false,
      synchronizationStatus: 'PENDING',
      status: TradingAccountStatus.PENDING,
      lastSyncAt: null,
      createdAt: new Date(),
    };

    const account = new TradingAccount(props);
    account.apply(
      new TradingAccountCreatedEvent(
        props.id,
        props.organizationId,
        props.workspaceId,
        props.connectorId,
        props.brokerName,
        props.accountNumber,
        props.status,
        props.createdAt,
      ),
    );

    return account;
  }

  public static reconstitute(props: TradingAccountProps): TradingAccount {
    return new TradingAccount(props);
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
  public get connectorId(): string {
    return this.props.connectorId;
  }
  public get brokerName(): string {
    return this.props.brokerName;
  }
  public get brokerServer(): string {
    return this.props.brokerServer;
  }
  public get accountNumber(): string {
    return this.props.accountNumber;
  }
  public get accountName(): string {
    return this.props.accountName;
  }
  public get accountType(): string {
    return this.props.accountType;
  }
  public get leverage(): string {
    return this.props.leverage;
  }
  public get currency(): string {
    return this.props.currency;
  }
  public get platform(): string {
    return this.props.platform;
  }
  public get terminalVersion(): string {
    return this.props.terminalVersion;
  }
  public get tradingEnabled(): boolean {
    return this.props.tradingEnabled;
  }
  public get synchronizationStatus(): string {
    return this.props.synchronizationStatus;
  }
  public get status(): TradingAccountStatus {
    return this.props.status;
  }
  public get lastSyncAt(): Date | null {
    return this.props.lastSyncAt;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public update(updates: { accountName?: string; tradingEnabled?: boolean }): void {
    if (this.props.status === TradingAccountStatus.ARCHIVED || this.props.status === TradingAccountStatus.DELETED) {
      throw new Error('Cannot update an archived or deleted trading account');
    }

    const appliedUpdates: Record<string, unknown> = {};

    if (updates.accountName !== undefined && updates.accountName !== this.props.accountName) {
      this.props.accountName = updates.accountName;
      appliedUpdates.accountName = updates.accountName;
    }

    if (updates.tradingEnabled !== undefined && updates.tradingEnabled !== this.props.tradingEnabled) {
      this.props.tradingEnabled = updates.tradingEnabled;
      appliedUpdates.tradingEnabled = updates.tradingEnabled;
    }

    if (Object.keys(appliedUpdates).length > 0) {
      this.apply(
        new TradingAccountUpdatedEvent(
          this.props.id,
          this.props.organizationId,
          this.props.workspaceId,
          appliedUpdates,
          new Date(),
        ),
      );
    }
  }

  public updateStatistics(
    balance: number,
    equity: number,
    margin: number,
    freeMargin: number,
    drawdown: number,
    floatingProfit: number,
    peakEquity: number,
  ): void {
    if (this.props.status === TradingAccountStatus.ARCHIVED || this.props.status === TradingAccountStatus.DELETED) {
      throw new Error('Cannot update statistics for an archived or deleted trading account');
    }

    this.apply(
      new AccountStatisticsUpdatedEvent(
        this.props.id,
        this.props.workspaceId,
        balance,
        equity,
        margin,
        freeMargin,
        drawdown,
        floatingProfit,
        peakEquity,
        new Date(),
      ),
    );
  }

  public archive(): void {
    if (this.props.status === TradingAccountStatus.ARCHIVED || this.props.status === TradingAccountStatus.DELETED) {
      return;
    }

    this.props.status = TradingAccountStatus.ARCHIVED;
    this.props.tradingEnabled = false;

    this.apply(
      new TradingAccountArchivedEvent(
        this.props.id,
        this.props.organizationId,
        this.props.workspaceId,
        new Date(),
      ),
    );
  }

  public delete(): void {
    if (this.props.status === TradingAccountStatus.DELETED) {
      return;
    }

    this.props.status = TradingAccountStatus.DELETED;
    this.props.tradingEnabled = false;

    this.apply(
      new TradingAccountDeletedEvent(
        this.props.id,
        this.props.organizationId,
        this.props.workspaceId,
        new Date(),
      ),
    );
  }
}
