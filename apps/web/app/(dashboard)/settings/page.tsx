'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@veerox/ui';
import { useWorkspace } from '../../../lib/context/workspace-context';

export default function SettingsPage() {
  const { currentOrganization, currentWorkspace } = useWorkspace();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Workspace & Organization Settings
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Configure risk parameters, member access, automation modes, and notification hooks.
          </p>
        </div>
        <Badge variant="brand" size="md">SETTINGS</Badge>
      </div>

      <Card glass bordered>
        <CardHeader>
          <CardTitle>Current Workspace Config</CardTitle>
          <CardDescription>Tenant details and operational automation mode</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Organization:</span>
              <span style={{ fontWeight: 600 }}>{currentOrganization?.name || 'Primary Org'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Workspace:</span>
              <span style={{ fontWeight: 600 }}>{currentWorkspace?.name || 'Default Workspace'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Automation Mode:</span>
              <Badge variant="brand" size="sm">{currentWorkspace?.automationMode || 'FULL_AUTO'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
