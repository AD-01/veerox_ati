import { Injectable } from '@nestjs/common';
import { ITradingAccountRepository } from '../../domain/repositories/trading-account.repository.interface';
import { TradingAccount, TradingAccountStatus } from '../../domain/aggregates/trading-account.aggregate';
import { PrismaService } from '@veerox/database/src/prisma.service';

@Injectable()
export class PrismaTradingAccountRepository implements ITradingAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: TradingAccount): Promise<void> {
    await this.prisma.tradingAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        organizationId: account.organizationId,
        workspaceId: account.workspaceId,
        connectorId: account.connectorId,
        brokerName: account.brokerName,
        brokerServer: account.brokerServer,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        leverage: account.leverage,
        currency: account.currency,
        platform: account.platform,
        terminalVersion: account.terminalVersion,
        tradingEnabled: account.tradingEnabled,
        synchronizationStatus: account.synchronizationStatus,
        status: account.status,
        lastSyncAt: account.lastSyncAt,
        createdAt: account.createdAt,
      },
      update: {
        accountName: account.accountName,
        tradingEnabled: account.tradingEnabled,
        status: account.status,
      },
    });
  }

  async findById(id: string, organizationId: string, workspaceId: string): Promise<TradingAccount | null> {
    const raw = await this.prisma.tradingAccount.findUnique({
      where: { id },
    });

    if (!raw || raw.organizationId !== organizationId || raw.workspaceId !== workspaceId) {
      return null;
    }

    return TradingAccount.reconstitute({
      id: raw.id,
      organizationId: raw.organizationId,
      workspaceId: raw.workspaceId,
      connectorId: raw.connectorId,
      brokerName: raw.brokerName,
      brokerServer: raw.brokerServer,
      accountNumber: raw.accountNumber,
      accountName: raw.accountName,
      accountType: raw.accountType,
      leverage: raw.leverage,
      currency: raw.currency,
      platform: raw.platform,
      terminalVersion: raw.terminalVersion,
      tradingEnabled: raw.tradingEnabled,
      synchronizationStatus: raw.synchronizationStatus,
      status: raw.status as TradingAccountStatus,
      lastSyncAt: raw.lastSyncAt,
      createdAt: raw.createdAt,
    });
  }

  async findAllByWorkspace(organizationId: string, workspaceId: string): Promise<TradingAccount[]> {
    const rawList = await this.prisma.tradingAccount.findMany({
      where: { organizationId, workspaceId, status: { not: TradingAccountStatus.DELETED } },
    });

    return rawList.map((raw) =>
      TradingAccount.reconstitute({
        id: raw.id,
        organizationId: raw.organizationId,
        workspaceId: raw.workspaceId,
        connectorId: raw.connectorId,
        brokerName: raw.brokerName,
        brokerServer: raw.brokerServer,
        accountNumber: raw.accountNumber,
        accountName: raw.accountName,
        accountType: raw.accountType,
        leverage: raw.leverage,
        currency: raw.currency,
        platform: raw.platform,
        terminalVersion: raw.terminalVersion,
        tradingEnabled: raw.tradingEnabled,
        synchronizationStatus: raw.synchronizationStatus,
        status: raw.status as TradingAccountStatus,
        lastSyncAt: raw.lastSyncAt,
        createdAt: raw.createdAt,
      }),
    );
  }

  async delete(id: string, organizationId: string, workspaceId: string): Promise<void> {
    await this.prisma.tradingAccount.deleteMany({
      where: {
        id,
        organizationId,
        workspaceId,
      },
    });
  }
}
