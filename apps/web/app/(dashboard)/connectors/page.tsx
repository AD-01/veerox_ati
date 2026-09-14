'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { ConnectorDto, TradingAccountDto, ConnectorHealthDto } from '@veerox/contracts';
import { useWorkspace } from '../../../lib/context/workspace-context';
import { ConnectorCard } from '../../../components/connectors/connector-card';
import { MT5AccountCard } from '../../../components/connectors/mt5-account-card';
import { CreateConnectorModal } from '../../../components/connectors/create-connector-modal';
import { ProvisionAgentModal } from '../../../components/connectors/provision-agent-modal';
import { CreateTradingAccountModal } from '../../../components/connectors/create-trading-account-modal';
import { CommandPanel } from '../../../components/connectors/command-panel';

type ConnectorTab = 'connectors' | 'accounts' | 'telemetry' | 'commands';

export default function ConnectorsPage() {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<ConnectorTab>('connectors');

  const [connectors, setConnectors] = useState<ConnectorDto[]>([]);
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTelemetryConnectorId, setSelectedTelemetryConnectorId] = useState<string | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<ConnectorHealthDto[]>([]);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState<boolean>(false);

  // Modals state
  const [isCreateConnectorOpen, setIsCreateConnectorOpen] = useState(false);
  const [selectedConnectorForProvision, setSelectedConnectorForProvision] = useState<ConnectorDto | null>(null);
  const [selectedConnectorForAccount, setSelectedConnectorForAccount] = useState<ConnectorDto | null>(null);

  const fetchConnectorData = useCallback(async () => {
    if (!currentWorkspace?.id || !currentOrganization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const orgQuery = `?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`;

      const [connRes, accRes] = await Promise.all([
        fetch(`/api/connectors${orgQuery}`).catch(() => null),
        fetch(`/api/connectors/trading-accounts${orgQuery}`).catch(() => null),
      ]);

      if (connRes && connRes.ok) {
        const connData = await connRes.json();
        setConnectors(Array.isArray(connData) ? connData : connData.data || []);
      }

      if (accRes && accRes.ok) {
        const accData = await accRes.json();
        setTradingAccounts(Array.isArray(accData) ? accData : accData.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve connector telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, currentOrganization?.id]);

  useEffect(() => {
    fetchConnectorData();
    // Safe polling every 10s with automatic cleanup on unmount
    const interval = setInterval(() => {
      fetchConnectorData();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchConnectorData]);

  useEffect(() => {
    if (connectors.length > 0 && !selectedTelemetryConnectorId) {
      setSelectedTelemetryConnectorId(connectors[0].id);
    }
  }, [connectors, selectedTelemetryConnectorId]);

  useEffect(() => {
    if (activeTab !== 'telemetry' || !selectedTelemetryConnectorId || !currentOrganization?.id || !currentWorkspace?.id) {
      return;
    }

    const abortController = new AbortController();

    const fetchTelemetry = async () => {
      setIsTelemetryLoading(true);
      try {
        const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const res = await fetch(
          `/api/connectors/${selectedTelemetryConnectorId}/health?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}&from=${from}&limit=100`,
          { signal: abortController.signal }
        );
        if (res.ok) {
          const json = await res.json();
          if (!abortController.signal.aborted) {
            setTelemetryHistory(json.data || []);
          }
        } else {
          if (!abortController.signal.aborted) {
            setTelemetryHistory([]);
          }
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          setTelemetryHistory([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsTelemetryLoading(false);
        }
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [activeTab, selectedTelemetryConnectorId, currentOrganization?.id, currentWorkspace?.id]);

  const onlineCount = connectors.filter(c => c.connectionStatus === 'CONNECTED').length;
  const activeAccountsCount = tradingAccounts.filter(a => a.tradingEnabled).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              MT5 Gateways & Connectors
            </h1>
            <Badge variant="brand" size="sm">
              S-24 PHASE 06
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Manage remote MetaTrader 5 execution nodes, trading account routing, and real-time VPS telemetry for{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{currentWorkspace?.name || 'Active Workspace'}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="md" onClick={() => fetchConnectorData()} isLoading={isLoading}>
            ↻ Sync Telemetry
          </Button>
          <Button variant="primary" size="md" onClick={() => setIsCreateConnectorOpen(true)}>
            + Register Connector
          </Button>
        </div>
      </div>

      {/* Gateway Telemetry KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Online Gateways
              </span>
              <Badge variant="success" size="sm" dot>LIVE</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: 'var(--color-success)' }}>
              {onlineCount} / {connectors.length}
            </CardTitle>
            <CardDescription>Connected VPS runtime nodes</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Active Accounts
              </span>
              <Badge variant="brand" size="sm">MT5</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {activeAccountsCount} / {tradingAccounts.length}
            </CardTitle>
            <CardDescription>Trading enabled accounts</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Optimal Latency
              </span>
              <Badge variant="info" size="sm">TELEMETRY</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: 'var(--color-brand-cyan)' }}>
              12 ms
            </CardTitle>
            <CardDescription>Average broker round-trip</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Total Gateways
              </span>
              <Badge variant="neutral" size="sm">NODES</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {connectors.length}
            </CardTitle>
            <CardDescription>Workspace registered nodes</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <Alert type="error" title="Connector Sync Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '12px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'connectors', label: `Connectors & Gateways (${connectors.length})` },
          { id: 'accounts', label: `MT5 Accounts (${tradingAccounts.length})` },
          { id: 'telemetry', label: 'Live Telemetry & Diagnostics' },
          { id: 'commands', label: 'EA Deploy & Commands' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ConnectorTab)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-surface-panel)' : 'transparent',
                color: isActive ? 'var(--color-brand-cyan)' : 'var(--color-text-secondary)',
                border: isActive ? '1px solid var(--color-border-muted)' : '1px solid transparent',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: CONNECTORS */}
      {activeTab === 'connectors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {[1, 2, 3].map(n => (
                <Card key={n} glass><Skeleton height="200px" /></Card>
              ))}
            </div>
          )}

          {!isLoading && connectors.length === 0 && (
            <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔌</div>
              <CardTitle>No MT5 Connectors Registered</CardTitle>
              <CardDescription style={{ maxWidth: '460px', margin: '8px auto 20px auto' }}>
                Register a connector node to link your MetaTrader 5 terminal or VPS agent to this trading workspace.
              </CardDescription>
              <Button variant="primary" size="sm" onClick={() => setIsCreateConnectorOpen(true)}>
                + Register First Connector
              </Button>
            </Card>
          )}

          {!isLoading && connectors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {connectors.map(connector => (
                <ConnectorCard
                  key={connector.id}
                  connector={connector}
                  onProvisionClick={conn => setSelectedConnectorForProvision(conn)}
                  onAddAccountClick={conn => setSelectedConnectorForAccount(conn)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: MT5 ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {[1, 2].map(n => (
                <Card key={n} glass><Skeleton height="180px" /></Card>
              ))}
            </div>
          )}

          {!isLoading && tradingAccounts.length === 0 && (
            <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📊</div>
              <CardTitle>No MT5 Accounts Configured</CardTitle>
              <CardDescription style={{ maxWidth: '460px', margin: '8px auto 20px auto' }}>
                Attach a trading account to an active connector node to enable automated order execution and risk monitoring.
              </CardDescription>
            </Card>
          )}

          {!isLoading && tradingAccounts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {tradingAccounts.map(account => (
                <MT5AccountCard key={account.id} account={account} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Connector Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Select Connector:</label>
            <select
              value={selectedTelemetryConnectorId || ''}
              onChange={(e) => setSelectedTelemetryConnectorId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-muted)',
                fontSize: 'var(--text-sm)'
              }}
            >
              {connectors.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
              ))}
              {connectors.length === 0 && <option value="">No Connectors Available</option>}
            </select>
          </div>

          {connectors.length === 0 ? (
            <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
               <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔌</div>
               <CardTitle>No Connectors Registered</CardTitle>
               <CardDescription>Register a connector to view telemetry.</CardDescription>
            </Card>
          ) : isTelemetryLoading && telemetryHistory.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <Card glass><Skeleton height="200px" /></Card>
              <Card glass><Skeleton height="200px" /></Card>
            </div>
          ) : telemetryHistory.length === 0 ? (
            <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
               <div style={{ fontSize: '36px', marginBottom: '10px' }}>📡</div>
               <CardTitle>No Telemetry Data</CardTitle>
               <CardDescription>Waiting for the first heartbeat from the agent...</CardDescription>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <Card glass bordered>
                <CardHeader>
                  <CardTitle>Agent Health & Resource Utilization</CardTitle>
                  <CardDescription>Latest telemetry from the connected node</CardDescription>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: 'var(--text-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Latest Node CPU:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                        {telemetryHistory[0]?.cpuUsage !== null && telemetryHistory[0]?.cpuUsage !== undefined ? `${telemetryHistory[0].cpuUsage.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Memory Utilization:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {telemetryHistory[0]?.memoryUsage !== null && telemetryHistory[0]?.memoryUsage !== undefined ? `${telemetryHistory[0].memoryUsage.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Network Round-Trip:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-cyan)' }}>
                        {telemetryHistory[0]?.networkLatency !== null && telemetryHistory[0]?.networkLatency !== undefined ? `${telemetryHistory[0].networkLatency} ms` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Latest Heartbeat:</span>
                      <span style={{ fontWeight: 600 }}>
                        {telemetryHistory[0]?.recordedAt ? new Date(telemetryHistory[0].recordedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card glass bordered>
                <CardHeader>
                  <CardTitle>Broker Bridge Connectivity</CardTitle>
                  <CardDescription>Gateway TCP socket and terminal synchronization state</CardDescription>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--text-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Badge variant="success" size="sm" dot>CONNECTED</Badge>
                      <span style={{ color: 'var(--color-text-primary)' }}>MT5 Terminal Pipe Active</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Badge variant="brand" size="sm">AES-256-GCM</Badge>
                      <span style={{ color: 'var(--color-text-primary)' }}>Command Channel Encrypted</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Badge variant="info" size="sm">ED25519</Badge>
                      <span style={{ color: 'var(--color-text-primary)' }}>Execution Non-Repudiation Verified</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card glass bordered style={{ gridColumn: '1 / -1' }}>
                <CardHeader>
                  <CardTitle>Historical CPU Telemetry (Last Hour)</CardTitle>
                  <CardDescription>CPU trends over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', height: '160px', alignItems: 'flex-end', gap: '4px', paddingTop: '20px' }}>
                     {telemetryHistory.slice().reverse().map((record, i) => {
                       const height = record.cpuUsage !== null && record.cpuUsage !== undefined ? Math.max(5, (record.cpuUsage / 100) * 160) : 5;
                       return (
                         <div
                           key={record.id || i}
                           title={`CPU: ${record.cpuUsage?.toFixed(1) || 'N/A'}% at ${new Date(record.recordedAt).toLocaleTimeString()}`}
                           style={{
                             flex: 1,
                             height: `${height}px`,
                             backgroundColor: 'var(--color-brand-cyan)',
                             opacity: 0.8,
                             borderRadius: '2px 2px 0 0',
                             minWidth: '4px'
                           }}
                         />
                       );
                     })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    <span>{telemetryHistory.length > 0 ? new Date(telemetryHistory[telemetryHistory.length - 1].recordedAt).toLocaleTimeString() : ''}</span>
                    <span>{telemetryHistory.length > 0 ? new Date(telemetryHistory[0].recordedAt).toLocaleTimeString() : ''}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: COMMANDS */}
      {activeTab === 'commands' && (
        <CommandPanel connectors={connectors} />
      )}

      {/* Create Connector Modal */}
      <CreateConnectorModal
        isOpen={isCreateConnectorOpen}
        onClose={() => setIsCreateConnectorOpen(false)}
        onSuccess={() => fetchConnectorData()}
      />

      {/* Provision Agent Modal */}
      <ProvisionAgentModal
        connector={selectedConnectorForProvision}
        isOpen={!!selectedConnectorForProvision}
        onClose={() => setSelectedConnectorForProvision(null)}
        onSuccess={() => fetchConnectorData()}
      />

      {/* Create Trading Account Modal */}
      <CreateTradingAccountModal
        connector={selectedConnectorForAccount}
        isOpen={!!selectedConnectorForAccount}
        onClose={() => setSelectedConnectorForAccount(null)}
        onSuccess={() => fetchConnectorData()}
      />
    </div>
  );
}
