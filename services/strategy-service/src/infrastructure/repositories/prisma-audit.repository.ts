import { Injectable } from '@nestjs/common';
import { IAuditRepository, AuditLogDto } from '../../application/ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async log(audit: AuditLogDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: audit.actorId || null,
        targetUserId: audit.targetUserId || null,
        organizationId: audit.organizationId || null,
        workspaceId: audit.workspaceId || null,
        targetEntityId: audit.targetEntityId || null,
        targetEntityType: audit.targetEntityType || null,
        action: audit.action,
        previousState: audit.previousState || null,
        newState: audit.newState || null,
        ipAddress: audit.ipAddress || null,
        device: audit.device || null,
        reason: audit.reason || null,
        correlationId: audit.correlationId || null,
      },
    });
  }
}
