import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';
import {
  ReceiveConnectorHeartbeatCommand,
  ClaimPendingCommandCommand,
  SubmitCommandResponseCommand,
} from '../../commands/connector-connectivity.commands';
import { IConnectorRepository, CONNECTOR_REPOSITORY } from '../../../domain/repositories/connector.repository.interface';
import { Inject } from '@nestjs/common';
import { IAuditRepository, AUDIT_REPOSITORY } from '../../ports/audit.repository.interface';

@CommandHandler(ReceiveConnectorHeartbeatCommand)
export class ReceiveConnectorHeartbeatHandler implements ICommandHandler<ReceiveConnectorHeartbeatCommand> {
  constructor(
    @Inject(CONNECTOR_REPOSITORY) private readonly connectorRepo: IConnectorRepository,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(command: ReceiveConnectorHeartbeatCommand): Promise<void> {
    const { connectorId, organizationId, workspaceId, payload } = command;

    const connector = await this.connectorRepo.findById(connectorId, organizationId, workspaceId);
    if (!connector) {
      throw new Error('Connector not found');
    }

    connector.heartbeat(payload.agentVersion);

    await this.connectorRepo.save(connector);

    if (payload.health) {
      await this.prisma.connectorHealth.create({
        data: {
          connectorId,
          cpuUsage: payload.health.cpuUsage ?? null,
          memoryUsage: payload.health.memoryUsage ?? null,
          diskUsage: payload.health.diskUsage ?? null,
          networkLatency: payload.health.networkLatency ?? null,
          activeTerminals: payload.health.activeTerminals ?? null,
          activeAccounts: payload.health.activeAccounts ?? null,
          healthScore: payload.health.healthScore ?? null,
        },
      });
    }

    // Do NOT generate excessive audit logs for every heartbeat as per S-13 pass 02 requirements
  }
}

@CommandHandler(ClaimPendingCommandCommand)
export class ClaimPendingCommandHandler implements ICommandHandler<ClaimPendingCommandCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute(command: ClaimPendingCommandCommand): Promise<any> {
    const { connectorId } = command;

    // We will select the oldest pending command
    const pendingCommand = await this.prisma.connectorCommand.findFirst({
      where: {
        connectorId,
        status: 'PENDING',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingCommand) {
      return null;
    }

    // Attempt to atomically claim it
    const updateResult = await this.prisma.connectorCommand.updateMany({
      where: {
        id: pendingCommand.id,
        status: 'PENDING', // Ensures it hasn't been claimed by another concurrent request
      },
      data: {
        status: 'CLAIMED',
        processedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Someone else claimed it or it was cancelled
      return null;
    }

    // We successfully claimed it. Return the command.
    return await this.prisma.connectorCommand.findUnique({
      where: { id: pendingCommand.id },
    });
  }
}

@CommandHandler(SubmitCommandResponseCommand)
export class SubmitCommandResponseHandler implements ICommandHandler<SubmitCommandResponseCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(command: SubmitCommandResponseCommand): Promise<void> {
    const { connectorId, organizationId, workspaceId, commandId, payload } = command;

    // Verify command exists and belongs to this connector and is claimed
    const updateResult = await this.prisma.connectorCommand.updateMany({
      where: {
        id: commandId,
        connectorId,
        status: 'CLAIMED',
      },
      data: {
        status: payload.responseCode === 'OK' ? 'COMPLETED' : 'FAILED',
      },
    });

    if (updateResult.count === 0) {
      throw new Error('Command not found, not claimed, or already processed');
    }

    // Insert response
    await this.prisma.connectorResponse.create({
      data: {
        commandId,
        connectorId,
        responseCode: payload.responseCode,
        responseMessage: payload.responseMessage,
        payloadJson: payload.payloadJson,
      },
    });

    await this.auditRepo.log({
      actorId: connectorId,
      action: 'CONNECTOR_COMMAND_RESPONDED',
      organizationId,
      workspaceId,
      targetEntityId: commandId,
      targetEntityType: 'ConnectorCommand',
      newState: payload.responseCode === 'OK' ? 'COMPLETED' : 'FAILED',
      reason: payload.responseMessage ?? undefined,
    });
  }
}

import { CheckStaleConnectorsCommand } from '../../commands/connector-connectivity.commands';

@CommandHandler(CheckStaleConnectorsCommand)
export class CheckStaleConnectorsHandler implements ICommandHandler<CheckStaleConnectorsCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    @Inject(CONNECTOR_REPOSITORY) private readonly connectorRepo: IConnectorRepository,
  ) {}

  async execute(command: CheckStaleConnectorsCommand): Promise<void> {
    const { timeoutSeconds } = command;
    const thresholdDate = new Date(Date.now() - timeoutSeconds * 1000);

    // Find all connectors that are CONNECTED but lastSeenAt < thresholdDate
    const staleConnectors = await this.prisma.connector.findMany({
      where: {
        connectionStatus: 'CONNECTED',
        lastSeenAt: {
          lt: thresholdDate,
        },
      },
    });

    for (const model of staleConnectors) {
      // Reconstitute aggregate to perform safe disconnect
      const connector = await this.connectorRepo.findById(model.id, model.organizationId, model.workspaceId);
      if (connector) {
        // Double check atomic logic (could use DB level but we need to fire DomainEvents via aggregate)
        connector.disconnect('STALE_HEARTBEAT_TIMEOUT');
        await this.connectorRepo.save(connector);
      }
    }
  }
}
