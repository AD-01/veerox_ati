/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AuditLogEntry {
  actorId?: string;
  targetUserId?: string;
  action: string;
  previousState?: string;
  newState?: string;
  ipAddress?: string;
  device?: string;
  reason?: string;
  correlationId?: string;
  organizationId?: string;
  workspaceId?: string;
  targetEntityId?: string;
  targetEntityType?: string;
}

export interface IAuditRepository {
  log(entry: AuditLogEntry, tx?: any): Promise<void>;
}
