'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Marketplace', href: '/marketplace', icon: '🛒', badge: 'PH-03' },
  { name: 'Licenses', href: '/licensing', icon: '🔑', badge: 'PH-05' },
  { name: 'Billing & Usage', href: '/billing', icon: '💳', badge: 'PH-04' },
  { name: 'MT5 Connectors', href: '/connectors', icon: '🔌' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'var(--color-surface-panel)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 12px',
        minHeight: 'calc(100vh - 64px)',
        flexShrink: 0,
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '8px 12px',
          }}
        >
          Navigation
        </div>

        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-brand-cyan)' : 'var(--color-text-secondary)',
                backgroundColor: isActive ? 'var(--color-surface-card-hover)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-brand-cyan)' : '3px solid transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--text-sm)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: 'var(--color-brand-cyan)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: '16px 12px',
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>VEEROX ATI ENGINE</span>
        <span>Version 1.0.0 (S-24)</span>
        <span style={{ color: 'var(--color-success)' }}>● Microservices Active</span>
      </div>
    </aside>
  );
};
