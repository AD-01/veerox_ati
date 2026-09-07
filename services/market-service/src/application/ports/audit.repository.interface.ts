export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditLogDto {
  actorId?: string | null;
  targetUserId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  targetEntityId?: string | null;
  targetEntityType?: string | null;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  reason?: string | null;
  correlationId?: string | null;
}

export interface IAuditRepository {
  log(audit: AuditLogDto): Promise<void>;
}
