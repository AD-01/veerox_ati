import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import {
  CreateTradingAccountCommand,
  UpdateTradingAccountCommand,
  ArchiveTradingAccountCommand,
  DeleteTradingAccountCommand,
  UpdateAccountStatisticsCommand,
  SyncOpenPositionsCommand,
} from '../../commands/trading-account.commands';
import { PrismaTradingAccountRepository } from '../../../infrastructure/repositories/prisma-trading-account.repository';
import { TradingAccount } from '../../../domain/aggregates/trading-account.aggregate';
import { randomUUID } from 'crypto';
import { NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaConnectorRepository } from '../../../infrastructure/repositories/prisma-connector.repository';
import { IAuditRepository, AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@CommandHandler(CreateTradingAccountCommand)
export class CreateTradingAccountHandler implements ICommandHandler<CreateTradingAccountCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    private readonly connectorRepository: PrismaConnectorRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateTradingAccountCommand): Promise<string> {
    const connector = await this.connectorRepository.findById(
      command.connectorId,
      command.organizationId,
      command.workspaceId,
    );

    if (!connector) {
      throw new ForbiddenException('Invalid connector or unauthorized access');
    }

    const accountId = randomUUID();
    const account = TradingAccount.create(
      accountId,
      command.organizationId,
      command.workspaceId,
      command.connectorId,
      command.brokerName,
      command.brokerServer,
      command.accountNumber,
      command.accountName,
      command.accountType,
      command.leverage,
      command.currency,
      command.platform,
      command.terminalVersion,
    );

    await this.repository.save(account);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'CreateTradingAccount',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: accountId,
        targetEntityType: 'TradingAccount',
        data: account
      }),
      reason: 'User created new trading account',
    });

    for (const event of account.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    account.commit();

    return accountId;
  }
}

@CommandHandler(UpdateTradingAccountCommand)
export class UpdateTradingAccountHandler implements ICommandHandler<UpdateTradingAccountCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateTradingAccountCommand): Promise<void> {
    const account = await this.repository.findById(
      command.accountId,
      command.organizationId,
      command.workspaceId,
    );

    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    const previousState = JSON.stringify(account);
    account.update(command.updates);
    await this.repository.save(account);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'UpdateTradingAccount',
      previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: account.id,
        targetEntityType: 'TradingAccount',
        data: account
      }),
      reason: 'User updated trading account',
    });

    for (const event of account.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    account.commit();
  }
}

@CommandHandler(ArchiveTradingAccountCommand)
export class ArchiveTradingAccountHandler implements ICommandHandler<ArchiveTradingAccountCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ArchiveTradingAccountCommand): Promise<void> {
    const account = await this.repository.findById(
      command.accountId,
      command.organizationId,
      command.workspaceId,
    );

    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    const previousState = JSON.stringify(account);
    account.archive();
    await this.repository.save(account);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'ArchiveTradingAccount',
      previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: account.id,
        targetEntityType: 'TradingAccount',
        data: account
      }),
      reason: 'User archived trading account',
    });

    for (const event of account.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    account.commit();
  }
}

@CommandHandler(DeleteTradingAccountCommand)
export class DeleteTradingAccountHandler implements ICommandHandler<DeleteTradingAccountCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteTradingAccountCommand): Promise<void> {
    const account = await this.repository.findById(
      command.accountId,
      command.organizationId,
      command.workspaceId,
    );

    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    const previousState = JSON.stringify(account);
    account.delete();
    await this.repository.save(account);

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'DeleteTradingAccount',
      previousState,
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: account.id,
        targetEntityType: 'TradingAccount',
        data: account
      }),
      reason: 'User deleted trading account',
    });

    for (const event of account.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    account.commit();
  }
}

@CommandHandler(UpdateAccountStatisticsCommand)
export class UpdateAccountStatisticsHandler implements ICommandHandler<UpdateAccountStatisticsCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateAccountStatisticsCommand): Promise<void> {
    const account = await this.repository.findById(
      command.accountId,
      command.organizationId,
      command.workspaceId,
    );

    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    const lastStats = await this.prisma.accountStatistics.findFirst({
      where: { accountId: command.accountId },
      orderBy: { snapshotTime: 'desc' },
    });

    const previousPeak = lastStats ? Number(lastStats.peakEquity) : command.equity;
    const newPeakEquity = Math.max(previousPeak, command.equity);

    account.updateStatistics(
      command.balance,
      command.equity,
      command.margin,
      command.freeMargin,
      command.drawdown,
      command.floatingProfit,
      newPeakEquity,
    );

    await this.repository.save(account);

    await this.prisma.accountStatistics.create({
      data: {
        accountId: command.accountId,
        balance: command.balance,
        equity: command.equity,
        margin: command.margin,
        freeMargin: command.freeMargin,
        drawdown: command.drawdown,
        floatingProfit: command.floatingProfit,
        peakEquity: newPeakEquity,
        snapshotTime: new Date(),
      },
    });

    await this.auditRepository.log({
      actorId: command.actorId,
      action: 'UpdateAccountStatistics',
      newState: JSON.stringify({
        organizationId: command.organizationId,
        workspaceId: command.workspaceId,
        targetEntityId: account.id,
        targetEntityType: 'TradingAccount',
        balance: command.balance,
        equity: command.equity,
      }),
      reason: 'System updated account statistics',
    });

    for (const event of account.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    account.commit();
  }
}

@CommandHandler(SyncOpenPositionsCommand)
export class SyncOpenPositionsHandler implements ICommandHandler<SyncOpenPositionsCommand> {
  constructor(
    private readonly repository: PrismaTradingAccountRepository,
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: SyncOpenPositionsCommand): Promise<void> {
    const account = await this.repository.findById(
      command.accountId,
      command.organizationId,
      command.workspaceId,
    );

    if (!account) {
      throw new NotFoundException('Trading account not found');
    }

    // 1. Upsert open positions read model
    await this.prisma.$transaction(async (tx) => {
      const incomingIds = command.positions.map((p) => p.id);
      
      await tx.openPositionReadModel.deleteMany({
        where: {
          workspaceId: command.workspaceId,
          id: { notIn: incomingIds },
        },
      });

      for (const pos of command.positions) {
        await tx.openPositionReadModel.upsert({
          where: { id: pos.id },
          create: {
            id: pos.id,
            workspaceId: command.workspaceId,
            symbolId: pos.symbolId,
            strategyId: pos.strategyId,
            status: pos.status,
            size: pos.size,
            direction: pos.direction,
            openPrice: pos.openPrice,
            currentPrice: pos.currentPrice,
            marginUsed: pos.marginUsed,
            updatedAt: new Date(),
          },
          update: {
            status: pos.status,
            size: pos.size,
            direction: pos.direction,
            currentPrice: pos.currentPrice,
            marginUsed: pos.marginUsed,
            updatedAt: new Date(),
          },
        });
      }
    });

    // 2. Query the latest AccountStatistics
    const lastStats = await this.prisma.accountStatistics.findFirst({
      where: { accountId: command.accountId },
      orderBy: { snapshotTime: 'desc' },
    });

    if (!lastStats) {
      return; // Cannot emit PortfolioSynchronizedEvent without stats
    }

    // 3. Emit PortfolioSynchronizedEvent
    const { PortfolioSynchronizedEvent } = await import('@veerox/events/src/trading-account.events');
    const event = new PortfolioSynchronizedEvent(
      command.accountId,
      command.workspaceId,
      command.organizationId,
      Number(lastStats.equity),
      Number(lastStats.margin),
      Number(lastStats.freeMargin),
      Number(lastStats.peakEquity),
      command.positions,
      new Date(),
    );

    this.eventBus.publish(event);
  }
}
