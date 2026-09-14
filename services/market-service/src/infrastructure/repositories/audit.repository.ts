import { Injectable } from '@nestjs/common';
import { IAuditRepository, AuditLogDto } from '../../application/ports/audit.repository.interface';
import { PrismaService } from '@veerox/database';

@Injectable()
export class AuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async log(audit: AuditLogDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: audit.actorId,
        targetUserId: audit.targetUserId || null,
        organizationId: audit.organizationId || null,
        workspaceId: audit.workspaceId || null,
        targetEntityId: audit.targetEntityId || null,
        targetEntityType: audit.targetEntityType || null,
        action: audit.action,
        previousState: audit.previousState,
        newState: audit.newState,
        ipAddress: audit.ipAddress,
        device: audit.device,
        reason: audit.reason,
        correlationId: audit.correlationId,
      },
    });
  }
}
