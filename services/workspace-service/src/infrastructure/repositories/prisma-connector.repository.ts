import { Injectable } from '@nestjs/common';
import { IConnectorRepository } from '../../domain/repositories/connector.repository.interface';
import { Connector, ConnectorStatus, ConnectorConnectionStatus } from '../../domain/aggregates/connector.aggregate';
import { PrismaService } from '@veerox/database/src/prisma.service';

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
}
