'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@veerox/ui';
import { TradingAccountDto } from '@veerox/contracts';

export interface MT5AccountCardProps {
  account: TradingAccountDto;
}

export const MT5AccountCard: React.FC<MT5AccountCardProps> = ({ account }) => {
  const pnl = Number(account.unrealizedPnl || 0);
  const pnlColor = pnl > 0 ? 'var(--color-success)' : pnl < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)';

  return (
    <Card glass bordered hoverable style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <Badge variant="brand" size="sm">
            {account.platform || 'MT5'} • {account.leverage || '1:100'}
          </Badge>
          <Badge variant={account.tradingEnabled ? 'success' : 'warning'} size="sm" dot>
            {account.tradingEnabled ? 'TRADING ACTIVE' : 'EXECUTION PAUSED'}
          </Badge>
        </div>

        <CardTitle style={{ fontSize: 'var(--text-lg)' }}>
          {account.accountName || `Account #${account.accountNumber}`}
        </CardTitle>
        <CardDescription>
          {account.brokerName} ({account.brokerServer}) • #{account.accountNumber}
        </CardDescription>
      </CardHeader>

      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Financial Metrics Grid */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-base)',
            border: '1px solid var(--color-border-subtle)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Balance:</span>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Equity:</span>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(account.equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Floating PnL:</span>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: pnlColor }}>
              {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Free Margin:</span>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              ${Number(account.freeMargin).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Sync Status Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          <span>Sync: <strong>{account.synchronizationStatus}</strong></span>
          <span>Terminal: <strong>{account.terminalVersion || 'Build 4150'}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
};
