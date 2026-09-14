'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@veerox/ui';
import { ConnectorDto } from '@veerox/contracts';

export interface ConnectorCardProps {
  connector: ConnectorDto;
  onProvisionClick: (connector: ConnectorDto) => void;
  onAddAccountClick: (connector: ConnectorDto) => void;
}

export const ConnectorCard: React.FC<ConnectorCardProps> = ({
  connector,
  onProvisionClick,
  onAddAccountClick,
}) => {
  const isOnline = connector.connectionStatus === 'CONNECTED';
  const isDegraded = connector.connectionStatus === 'DEGRADED';
  const isProvisioned = connector.connectionStatus === 'PROVISIONED';

  const statusVariant = isOnline ? 'success' : isDegraded ? 'warning' : isProvisioned ? 'brand' : 'neutral';
  const statusLabel = isOnline ? 'ONLINE' : isDegraded ? 'DEGRADED' : isProvisioned ? 'PROVISIONED' : 'OFFLINE';

  const health = connector.healthRecords && connector.healthRecords.length > 0 ? connector.healthRecords[0] : null;

  return (
    <Card glass bordered hoverable style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <Badge variant="brand" size="sm">
            {connector.provider || 'MT5'}
          </Badge>
          <Badge variant={statusVariant as any} size="sm" dot>
            {statusLabel}
          </Badge>
        </div>

        <CardTitle style={{ fontSize: 'var(--text-lg)' }}>{connector.name}</CardTitle>
        <CardDescription>
          ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-cyan)' }}>{connector.id.substring(0, 13)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Telemetry snippet */}
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-base)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Last Heartbeat:</span>
            <span style={{ color: isOnline ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
              {connector.lastSeenAt ? new Date(connector.lastSeenAt).toLocaleTimeString() : 'Never'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Agent ID:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              {connector.agentId ? `${connector.agentId.substring(0, 8)}...` : 'Not Provisioned'}
            </span>
          </div>

          {health && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Latency / CPU:</span>
              <span style={{ color: 'var(--color-brand-cyan)', fontWeight: 600 }}>
                {health.networkLatency ?? 0}ms / {Number(health.cpuUsage ?? 0).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter style={{ marginTop: '16px', paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link href={`/connectors/${connector.id}`} style={{ flex: 1 }}>
          <Button variant="outline" size="sm" style={{ width: '100%' }}>
            Inspect Details
          </Button>
        </Link>

        {!connector.agentId ? (
          <Button variant="primary" size="sm" onClick={() => onProvisionClick(connector)} style={{ flex: 1 }}>
            Provision Agent
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onAddAccountClick(connector)} style={{ flex: 1 }}>
            + MT5 Account
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
