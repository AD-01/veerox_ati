'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'General', href: '/settings' },
    { name: 'Members', href: '/settings/members' },
    { name: 'Workspaces', href: '/settings/workspaces' },
    { name: 'Audit Logs', href: '/settings/audit-logs' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
        {tabs.map(tab => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-brand-cyan)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-surface-card-hover)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
