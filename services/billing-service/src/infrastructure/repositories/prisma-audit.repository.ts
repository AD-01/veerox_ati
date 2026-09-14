import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@veerox/database';
import { AuditLogEntry, IAuditRepository } from '../../application/ports/audit.repository.interface';

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId || null,
        targetUserId: entry.targetUserId || null,
        action: entry.action,
        previousState: entry.previousState || null,
        newState: entry.newState || null,
        ipAddress: entry.ipAddress || null,
        device: entry.device || null,
        reason: entry.reason || null,
        correlationId: entry.correlationId || null,
        organizationId: entry.organizationId || null,
        workspaceId: entry.workspaceId || null,
        targetEntityId: entry.targetEntityId || null,
        targetEntityType: entry.targetEntityType || null
      }
    });
  }
}
