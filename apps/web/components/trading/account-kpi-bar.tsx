'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Alert, Skeleton, Dropdown, DropdownItem } from '@veerox/ui';
import { TradingAccountDto, EventEnvelope } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useTradingRealtime } from '../../lib/hooks/useTradingRealtime';

export const AccountKpiBar: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const { lastEvent, isConnected, error: wsError } = useTradingRealtime({
    organizationId: currentOrganization?.id,
    workspaceId: currentWorkspace?.id,
    enabled: true,
  });

  const fetchAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !currentOrganization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const orgQuery = `?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`;
      const res = await fetch(`/api/connectors/trading-accounts${orgQuery}`);
      
      if (!res.ok) {
        throw new Error('Failed to retrieve trading accounts telemetry.');
      }
      
      const data = await res.json();
      const accounts: TradingAccountDto[] = Array.isArray(data) ? data : data.data || [];
      
      setTradingAccounts(accounts);
      setLastSyncTime(new Date());
      setError(null);

      // Auto-select first active/available account if none selected or if selection is invalid
      if (accounts.length > 0) {
        const isSelectedValid = accounts.some(a => a.id === selectedAccountId);
        if (!isSelectedValid) {
          const defaultAccount = accounts.find(a => a.tradingEnabled) || accounts[0];
          setSelectedAccountId(defaultAccount.id);
        }
      } else {
        setSelectedAccountId(null);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching account metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, currentOrganization?.id, selectedAccountId]);

  useEffect(() => {
    setIsLoading(true); // Show loading state when workspace changes
    fetchAccounts();
  }, [fetchAccounts, isConnected]); // Resync when connection restores

  useEffect(() => {
    if (!lastEvent) return;
    
    if (lastEvent.eventType === 'AccountStateChanged') {
      const updatedAccount = lastEvent.data as TradingAccountDto;
      setTradingAccounts(prev => {
        const idx = prev.findIndex(a => a.id === updatedAccount.id);
        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = { ...newArr[idx], ...updatedAccount };
          return newArr;
        }
        return prev;
      });
      setLastSyncTime(new Date());
    }
  }, [lastEvent]);

  const activeAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return tradingAccounts.find(a => a.id === selectedAccountId) || null;
  }, [selectedAccountId, tradingAccounts]);

  const formatCurrency = (value: number | undefined | null) => {
    const val = Number(value || 0);
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPnL = (value: number | undefined | null) => {
    const pnl = Number(value || 0);
    const formatted = Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (pnl > 0) return `+$${formatted}`;
    if (pnl < 0) return `-$${formatted}`;
    return `$0.00`;
  };

  const getPnLColor = (value: number | undefined | null) => {
    const pnl = Number(value || 0);
    if (pnl > 0) return 'var(--color-success)';
    if (pnl < 0) return 'var(--color-danger)';
    return 'var(--color-text-primary)';
  };

  // Loading State
  if (isLoading && tradingAccounts.length === 0) {
    return (
      <Card glass bordered>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width={200} height="28px" />
            <Skeleton width={120} height="28px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <Skeleton height="64px" />
            <Skeleton height="64px" />
            <Skeleton height="64px" />
            <Skeleton height="64px" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (error && tradingAccounts.length === 0) {
    return (
      <Alert type="error" title="Telemetry Sync Failed">
        {error} 
        <Button variant="secondary" size="sm" onClick={() => fetchAccounts()} style={{ marginLeft: '12px' }}>
          Retry
        </Button>
      </Alert>
    );
  }

  // Empty State
  if (tradingAccounts.length === 0) {
    return (
      <Card glass bordered>
        <CardContent style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: '12px', fontSize: 'var(--text-3xl)' }}>📊</div>
          <CardTitle style={{ marginBottom: '8px' }}>No Trading Accounts Found</CardTitle>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px', maxWidth: '400px' }}>
            There are no MT5 accounts registered or linked to the active workspace.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/connectors'}>
            Manage Connectors
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!activeAccount) {
    return null;
  }

  const pnlPercent = activeAccount.balance > 0 
    ? (Number(activeAccount.unrealizedPnl || 0) / Number(activeAccount.balance)) * 100 
    : 0;

  const marginUtil = activeAccount.equity > 0 
    ? (Number(activeAccount.marginUsed || 0) / Number(activeAccount.equity)) * 100 
    : 0;

  return (
    <Card glass bordered style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Left: Account Selector & Context */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {tradingAccounts.length > 1 ? (
              <Dropdown
                trigger={<Button variant="secondary" size="md">Account: {activeAccount.accountName || activeAccount.accountNumber} ▼</Button>}
                items={tradingAccounts.map(acc => ({
                  id: acc.id,
                  label: acc.accountName || acc.accountNumber,
                  sublabel: acc.brokerName,
                  badge: acc.tradingEnabled ? <Badge variant="success" size="sm" dot>LIVE</Badge> : undefined,
                  onClick: () => setSelectedAccountId(acc.id)
                }))}
              />
            ) : (
              <Badge variant="brand" size="md">
                {activeAccount.accountName || `Account #${activeAccount.accountNumber}`}
              </Badge>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {activeAccount.brokerName} ({activeAccount.brokerServer})
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {activeAccount.platform} • {activeAccount.currency} • Leverage {activeAccount.leverage || '1:100'}
              </span>
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              <div>Last Sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : '--:--:--'}</div>
              <div>Status: {activeAccount.synchronizationStatus || 'UNKNOWN'}</div>
            </div>
            
            <Badge 
              variant={activeAccount.tradingEnabled ? 'success' : (activeAccount.executionHalted ? 'danger' : 'warning')} 
              size="sm" 
              dot
            >
              {activeAccount.tradingEnabled ? 'TRADING ACTIVE' : (activeAccount.executionHalted ? 'HALTED' : 'EXECUTION PAUSED')}
            </Badge>

            <Button variant="secondary" size="sm" onClick={() => fetchAccounts()} isLoading={isLoading && tradingAccounts.length > 0}>
              ↻
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          
          {/* Balance */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Balance
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(activeAccount.balance)}
            </div>
          </div>

          {/* Equity */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Equity
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(activeAccount.equity)}
            </div>
          </div>

          {/* Floating PnL */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Floating PnL
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div 
                style={{ 
                  fontSize: 'var(--text-2xl)', 
                  fontWeight: 800, 
                  color: getPnLColor(activeAccount.unrealizedPnl),
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {formatPnL(activeAccount.unrealizedPnl)}
              </div>
              {activeAccount.balance > 0 && (
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: getPnLColor(activeAccount.unrealizedPnl) }}>
                  ({pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>

          {/* Margin Metrics */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Margin Used</span>
              {marginUtil > 0 && <span>{marginUtil.toFixed(1)}%</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(activeAccount.marginUsed)}
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Free: <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(activeAccount.freeMargin)}</span>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};
