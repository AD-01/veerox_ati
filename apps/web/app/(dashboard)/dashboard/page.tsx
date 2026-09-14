'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@veerox/ui';
import { useAuth } from '../../../lib/context/auth-context';
import { useWorkspace } from '../../../lib/context/workspace-context';
import { AccountKpiBar } from '../../../components/trading/account-kpi-bar';
import { EquityChart } from '../../../components/trading/equity-chart';
import { PositionsTable } from '../../../components/trading/positions-table';
import { OrdersTable } from '../../../components/trading/orders-table';
import { RiskGauge } from '../../../components/trading/risk-gauge';
import { MarketWatch } from '../../../components/trading/market-watch';
import { TradeTicket } from '../../../components/trading/trade-ticket';
import { StrategyStatus } from '../../../components/trading/strategy-status';
import Link from 'next/link';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const { currentOrganization, currentWorkspace } = useWorkspace();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
            }}
          >
            Trading Workspace Overview
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Welcome back, <span style={{ color: 'var(--color-brand-cyan)', fontWeight: 600 }}>{user?.email}</span>. Operating under{' '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{currentWorkspace?.name || 'Default Workspace'}</span>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/marketplace">
            <Button variant="primary" size="md">
              Explore Marketplace
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="secondary" size="md">
              Workspace Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* S-24 Operational Cockpit Shell */}
      <div className="cockpit-grid">
        
        {/* Tier 1: Immediate Operational State */}
        <div className="cockpit-col-full">
          <AccountKpiBar />
        </div>



        {/* Tier 2: Active Trading Context */}
        <div className="cockpit-col-main">
          <EquityChart />
        </div>
        <div className="cockpit-col-side">
          <TradeTicket />
        </div>

        {/* Tier 3: Supporting Telemetry */}
        <div className="cockpit-col-main">
          <MarketWatch />
        </div>
        <div className="cockpit-col-side">
          <RiskGauge />
          <div style={{ marginTop: '24px' }}>
            <StrategyStatus />
          </div>
        </div>

        {/* Tier 4: Execution State */}
        <div className="cockpit-col-full">
          <PositionsTable />
        </div>
        <div className="cockpit-col-full">
          <OrdersTable />
        </div>
      </div>

      {/* Tenant Context & Platform Architecture Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        <Card bordered>
          <CardHeader>
            <CardTitle>Active Tenant Boundaries</CardTitle>
            <CardDescription>Cryptographic session & tenant isolation context</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Organization ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-brand-cyan)' }}>
                  {currentOrganization?.id || 'org-default-primary'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Workspace ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-brand-cyan)' }}>
                  {currentWorkspace?.id || 'ws-main-quant'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Authentication State:</span>
                <Badge variant="success" size="sm">HttpOnly Cookie Validated</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>User Roles:</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  {user?.roles?.join(', ') || 'TRADER'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card bordered>
          <CardHeader>
            <CardTitle>EPIC-05 UX Platform Roadmap</CardTitle>
            <CardDescription>Upcoming sprint phases and modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  Phase 01: Commercial REST & BFF Transport
                </span>
                <Badge variant="success" size="sm">CLOSED</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  Phase 02: Core Web Foundation & Auth Shell
                </span>
                <Badge variant="brand" size="sm">ACTIVE</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Phase 03: Marketplace Catalog & Purchase UX
                </span>
                <Badge variant="neutral" size="sm">UPCOMING</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Phase 04: Billing, Invoices & Usage UI
                </span>
                <Badge variant="neutral" size="sm">UPCOMING</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Phase 05: Licensing Management & Key Verification
                </span>
                <Badge variant="neutral" size="sm">UPCOMING</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
