import { Injectable } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { AuditLogEntry, IAuditRepository } from '../../application/ports/audit.repository.interface';

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.auditLog.create({
      data: {
        action: entry.action,
        organizationId: entry.organizationId || null,
        workspaceId: entry.workspaceId || null,
        targetEntityId: entry.targetEntityId || null,
        targetEntityType: entry.targetEntityType || null,
        previousState: entry.previousState || null,
        newState: entry.newState || null
      }
    });
  }
}