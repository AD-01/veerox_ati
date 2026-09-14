import { Injectable } from '@nestjs/common';
import { IConnectorRepository } from '../../domain/repositories/connector.repository.interface';
import { Connector, ConnectorStatus, ConnectorConnectionStatus } from '../../domain/aggregates/connector.aggregate';
import { PrismaService } from '@veerox/database';

@Injectable()
export class PrismaConnectorRepository implements IConnectorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(connector: Connector): Promise<void> {
    // We must use "as any" since aggregate getter is currently private for props, 
    // Wait, the aggregate exposes getters:
    await this.prisma.connector.upsert({
      where: { id: connector.id },
      create: {
        id: connector.id,
        organizationId: connector.organizationId,
        workspaceId: connector.workspaceId,
        name: connector.name,
        provider: connector.provider,
        status: connector.status,
        connectionStatus: connector.connectionStatus,
        lastSeenAt: connector.lastSeenAt,
        createdAt: connector.createdAt,
      },
      update: {
        name: connector.name,
        status: connector.status,
        connectionStatus: connector.connectionStatus,
        lastSeenAt: connector.lastSeenAt,
      },
    });
  }

  async findById(id: string, organizationId: string, workspaceId: string): Promise<Connector | null> {
    const raw = await this.prisma.connector.findUnique({
      where: { id },
    });

    if (!raw || raw.organizationId !== organizationId || raw.workspaceId !== workspaceId) {
      return null;
    }

    return Connector.reconstitute({
      id: raw.id,
      organizationId: raw.organizationId,
      workspaceId: raw.workspaceId,
      name: raw.name,
      provider: raw.provider,
      status: raw.status as ConnectorStatus,
      connectionStatus: raw.connectionStatus as ConnectorConnectionStatus,
      lastSeenAt: raw.lastSeenAt,
      createdAt: raw.createdAt,
    });
  }

  async findAllByWorkspace(organizationId: string, workspaceId: string): Promise<Connector[]> {
    const rawList = await this.prisma.connector.findMany({
      where: { organizationId, workspaceId },
    });

    return rawList.map((raw) =>
      Connector.reconstitute({
        id: raw.id,
        organizationId: raw.organizationId,
        workspaceId: raw.workspaceId,
        name: raw.name,
        provider: raw.provider,
        status: raw.status as ConnectorStatus,
        connectionStatus: raw.connectionStatus as ConnectorConnectionStatus,
        lastSeenAt: raw.lastSeenAt,
        createdAt: raw.createdAt,
      }),
    );
  }

  async getHealthHistory(
    connectorId: string,
    organizationId: string,
    workspaceId: string,
    from: Date,
    to: Date,
    limit: number
  ): Promise<any[]> {
    // Verify the connector belongs to the org/workspace
    const connector = await this.prisma.connector.findUnique({
      where: { id: connectorId },
      select: { organizationId: true, workspaceId: true }
    });

    if (!connector || connector.organizationId !== organizationId || connector.workspaceId !== workspaceId) {
      return [];
    }

    const records = await this.prisma.connectorHealth.findMany({
      where: {
        connectorId,
        recordedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
      take: limit,
    });

    return records.map(r => ({
      id: r.id,
      connectorId: r.connectorId,
      cpuUsage: r.cpuUsage ? Number(r.cpuUsage) : null,
      memoryUsage: r.memoryUsage ? Number(r.memoryUsage) : null,
      diskUsage: r.diskUsage ? Number(r.diskUsage) : null,
      networkLatency: r.networkLatency,
      activeTerminals: r.activeTerminals,
      activeAccounts: r.activeAccounts,
      healthScore: r.healthScore,
      recordedAt: r.recordedAt,
    }));
  }

  async getCommandHistory(
    connectorId: string,
    organizationId: string,
    workspaceId: string,
    limit: number
  ): Promise<any[]> {
    // Verify the connector belongs to the org/workspace
    const connector = await this.prisma.connector.findUnique({
      where: { id: connectorId },
      select: { organizationId: true, workspaceId: true }
    });

    if (!connector || connector.organizationId !== organizationId || connector.workspaceId !== workspaceId) {
      return [];
    }

    const commands = await this.prisma.connectorCommand.findMany({
      where: { connectorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return commands.map(c => ({
      id: c.id,
      connectorId: c.connectorId,
      commandType: c.commandType,
      payloadJson: c.payloadJson,
      status: c.status,
      retries: c.retries,
      sequenceNumber: 0, // Fallback, not strictly in Prisma model
      clientExecutionId: undefined, // Extracted in handler from payloadJson
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.processedAt ? c.processedAt.toISOString() : undefined,
    }));
  }
}
