'use client';

import React from 'react';
import { Topbar } from '../../components/layout/topbar';
import { Sidebar } from '../../components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--color-bg)' }}>
          <div className="page-wrapper">{children}</div>
        </main>
      </div>
    </div>
  );
}
