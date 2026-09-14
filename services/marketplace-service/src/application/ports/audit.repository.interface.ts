export interface AuditLogEntry {
  action: string;
  previousState?: string;
  newState?: string;
  organizationId?: string;
  workspaceId?: string;
  targetEntityId?: string;
  targetEntityType?: string;
}

export interface IAuditRepository {
  log(entry: AuditLogEntry, tx?: any): Promise<void>;
}
