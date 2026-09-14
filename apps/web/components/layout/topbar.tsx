'use client';

import React from 'react';
import { Badge, Avatar, Dropdown, DropdownItem } from '@veerox/ui';
import { useAuth } from '../../lib/context/auth-context';
import { useWorkspace } from '../../lib/context/workspace-context';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { currentOrganization, currentWorkspace, workspaces, selectWorkspace } = useWorkspace();

  const workspaceDropdownItems: DropdownItem[] = workspaces.map(ws => ({
    id: ws.id,
    label: ws.name,
    sublabel: currentOrganization?.name,
    badge: ws.id === currentWorkspace?.id ? <Badge variant="brand" size="sm">ACTIVE</Badge> : undefined,
    onClick: () => selectWorkspace(ws.id),
  }));

  const userDropdownItems: DropdownItem[] = [
    {
      id: 'profile-info',
      label: user?.email || 'Authenticated User',
      sublabel: user?.roles?.join(', ') || 'TRADER',
      disabled: true,
    },
    {
      id: 'logout-action',
      label: 'Sign Out',
      danger: true,
      onClick: () => logout(),
    },
  ];

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--color-surface-panel)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Brand Logo & Workspace Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-brand-cyan), #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#ffffff',
              fontSize: '16px',
            }}
          >
            V
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: 'var(--text-lg)',
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            VEEROX <span style={{ color: 'var(--color-brand-cyan)' }}>ATI</span>
          </span>
        </div>

        <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--color-border-subtle)' }} />

        {/* Workspace Switcher */}
        <Dropdown
          align="left"
          width="260px"
          items={workspaceDropdownItems}
          trigger={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-muted)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Workspace:</span>
              <span style={{ color: 'var(--color-brand-cyan)' }}>
                {currentWorkspace?.name || 'Default Workspace'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>▼</span>
            </div>
          }
        />
      </div>

      {/* Right: System Status & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* System Health Indicator */}
        <Badge variant="success" dot size="sm">
          ENGINE LIVE
        </Badge>

        {/* User Profile Avatar Dropdown */}
        <Dropdown
          align="right"
          width="220px"
          items={userDropdownItems}
          trigger={
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={user?.email || 'User'} size="sm" status="online" />
            </div>
          }
        />
      </div>
    </header>
  );
};
