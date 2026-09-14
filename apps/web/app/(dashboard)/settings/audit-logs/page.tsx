'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Button } from '@veerox/ui';
import { useWorkspace } from '../../../../lib/context/workspace-context';
import { AuditLogDto } from '@veerox/contracts';

export default function AdminAuditLogsPage() {
  const { currentOrganization } = useWorkspace();
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/organizations/${currentOrganization.id}/audit-logs?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json() as AuditLogDto[];
        setLogs(data);
      } else if (res.status === 401) {
        setError('Authentication error. Please log in again.');
      } else if (res.status === 403) {
        setError('You do not have permission to view audit logs.');
      } else if (res.status === 404) {
        setError('Organization not found.');
      } else {
        setError(`Failed to fetch audit logs: ${res.statusText}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Audit Trails
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Immutable security and governance records for {currentOrganization?.name || 'your organization'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Input placeholder="Search audit logs..." style={{ width: '250px' }} />
        </div>
      </div>

      <Card glass bordered>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Comprehensive log of all administrative actions</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-error)' }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading audit records...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Timestamp</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Action</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Actor</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Target</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{log.action}</td>
                      <td style={{ padding: '12px 8px' }}>{log.actorId}</td>
                      <td style={{ padding: '12px 8px' }}>{log.targetEntityId || log.targetUserId || '-'}</td>
                      <td style={{ padding: '12px 8px' }}>
                         <Badge variant="outline" size="sm">{log.reason || '-'}</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {logs.length > 0 && !loading && !error && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                Page {page}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                disabled={logs.length < limit}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
