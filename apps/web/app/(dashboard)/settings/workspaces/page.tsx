'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input } from '@veerox/ui';
import { useWorkspace } from '../../../../lib/context/workspace-context';
import { WorkspaceDto } from '@veerox/contracts';

export default function AdminWorkspacesPage() {
  const { currentOrganization } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWorkspaces = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/organizations/${currentOrganization.id}/workspaces`);
      if (res.ok) {
        const data = await res.json() as WorkspaceDto[];
        setWorkspaces(data);
      } else if (res.status === 401) {
        setError('Authentication error. Please log in again.');
      } else if (res.status === 403) {
        setError('You do not have permission to view workspaces.');
      } else if (res.status === 404) {
        setError('Organization not found.');
      } else {
        setError(`Failed to fetch workspaces: ${res.statusText}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Workspaces
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Manage and govern trading workspaces within {currentOrganization?.name || 'your organization'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Input placeholder="Search workspaces..." style={{ width: '250px' }} />
          <Button variant="default">Create Workspace</Button>
        </div>
      </div>

      <Card glass bordered>
        <CardHeader>
          <CardTitle>Workspace Directory</CardTitle>
          <CardDescription>Overview of all active and archived workspaces</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-error)' }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading workspaces...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Workspace Name</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Automation Mode</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.length === 0 ? (
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No workspaces found.
                    </td>
                  </tr>
                ) : (
                  workspaces.map((ws) => (
                    <tr key={ws.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{ws.name}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <Badge variant={ws.status === 'ACTIVE' ? 'success' : 'outline'} size="sm">
                          {ws.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <Badge variant="default" size="sm">
                          {ws.configuration?.automationMode ?? 'Not Configured'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <Button variant="ghost" size="sm">Configure</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
