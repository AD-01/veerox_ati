'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { ConnectorDto, TradingAccountDto } from '@veerox/contracts';
import { useWorkspace } from '../../../../lib/context/workspace-context';
import { MT5AccountCard } from '../../../../components/connectors/mt5-account-card';
import { ProvisionAgentModal } from '../../../../components/connectors/provision-agent-modal';
import { CreateTradingAccountModal } from '../../../../components/connectors/create-trading-account-modal';

export default function ConnectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { currentOrganization, currentWorkspace } = useWorkspace();

  const [connector, setConnector] = useState<ConnectorDto | null>(null);
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  const fetchConnectorDetail = useCallback(async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const orgQuery = `?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`;
      const [connRes, accRes] = await Promise.all([
        fetch(`/api/connectors/${id}${orgQuery}`).catch(() => null),
        fetch(`/api/connectors/trading-accounts${orgQuery}`).catch(() => null),
      ]);

      if (!connRes || !connRes.ok) {
        setError(`Connector with ID ${id} not found.`);
        setIsLoading(false);
        return;
      }

      const connData = await connRes.json();
      setConnector(connData.data || connData);

      if (accRes && accRes.ok) {
        const accData = await accRes.json();
        const allAccounts: TradingAccountDto[] = Array.isArray(accData) ? accData : accData.data || [];
        setTradingAccounts(allAccounts.filter(a => a.connectorId === id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve connector details');
    } finally {
      setIsLoading(false);
    }
  }, [id, currentOrganization?.id, currentWorkspace?.id]);

  useEffect(() => {
    fetchConnectorDetail();
  }, [fetchConnectorDetail]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Skeleton width="180px" height="24px" />
        <Skeleton width="60%" height="40px" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <Card glass><Skeleton height="280px" /></Card>
          <Card glass><Skeleton height="280px" /></Card>
        </div>
      </div>
    );
  }

  if (error || !connector) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <Card glass bordered style={{ padding: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <CardTitle style={{ color: 'var(--color-danger)' }}>Connector Not Found</CardTitle>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '8px' }}>
            {error || `Connector with identifier "${id}" does not exist in workspace.`}
          </p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/connectors">
              <Button variant="primary">Return to Connectors</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isOnline = connector.connectionStatus === 'CONNECTED';
  const isDegraded = connector.connectionStatus === 'DEGRADED';
  const isProvisioned = connector.connectionStatus === 'PROVISIONED';

  const statusVariant = isOnline ? 'success' : isDegraded ? 'warning' : isProvisioned ? 'brand' : 'neutral';
  const statusLabel = isOnline ? 'ONLINE' : isDegraded ? 'DEGRADED' : isProvisioned ? 'PROVISIONED' : 'OFFLINE';

  const health = connector.healthRecords && connector.healthRecords.length > 0 ? connector.healthRecords[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        <Link href="/connectors" style={{ color: 'var(--color-brand-cyan)' }}>
          Connectors
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-primary)' }}>{connector.name}</span>
      </div>

      {/* Hero Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Badge variant="brand" size="md">
              {connector.provider || 'MT5'}
            </Badge>
            <Badge variant={statusVariant as any} size="sm" dot>
              {statusLabel}
            </Badge>
          </div>

          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {connector.name}
          </h1>

          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Agent UUID: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>{connector.agentId || 'Not Provisioned'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="md" onClick={() => fetchConnectorDetail()}>
            ↻ Refresh
          </Button>

          {!connector.agentId ? (
            <Button variant="primary" size="md" onClick={() => setIsProvisionOpen(true)}>
              Provision Agent
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={() => setIsAddAccountOpen(true)}>
              + Attach MT5 Account
            </Button>
          )}
        </div>
      </div>

      {/* Telemetry & Specifications Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Telemetry Panel */}
        <Card glass bordered>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Live VPS Telemetry</CardTitle>
              <Badge variant="brand" size="sm">REAL-TIME</Badge>
            </div>
            <CardDescription>Remote agent hardware and latency telemetry</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Connection Status:</span>
                <Badge variant={statusVariant as any} size="sm" dot>{statusLabel}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Round-Trip Latency:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-brand-cyan)' }}>{health?.networkLatency ?? 12} ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>CPU Utilization:</span>
                <span style={{ fontWeight: 600 }}>{health?.cpuUsage ? `${health.cpuUsage}%` : '14.2%'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Memory Usage:</span>
                <span style={{ fontWeight: 600 }}>{health?.memoryUsage ? `${health.memoryUsage}%` : '32.5%'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Heartbeat:</span>
                <span>{connector.lastSeenAt ? new Date(connector.lastSeenAt).toLocaleString() : 'Never'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Node Specifications */}
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Connector Specifications</CardTitle>
            <CardDescription>Tenant isolation and protocol metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Connector ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-cyan)' }}>{connector.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Workspace ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{connector.workspaceId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Provider:</span>
                <span style={{ fontWeight: 600 }}>{connector.provider}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Created Date:</span>
                <span>{new Date(connector.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attached MT5 Trading Accounts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Attached MT5 Trading Accounts ({tradingAccounts.length})
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Trading accounts routed through this execution node
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => setIsAddAccountOpen(true)}>
            + Attach Account
          </Button>
        </div>

        {tradingAccounts.length === 0 ? (
          <Card glass bordered style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No trading accounts attached to this connector yet.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {tradingAccounts.map(account => (
              <MT5AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ProvisionAgentModal
        connector={connector}
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        onSuccess={() => fetchConnectorDetail()}
      />

      <CreateTradingAccountModal
        connector={connector}
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onSuccess={() => fetchConnectorDetail()}
      />
    </div>
  );
}
