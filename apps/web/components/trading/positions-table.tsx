'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { PositionDto, TradingAccountDto, EventEnvelope } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useTradingRealtime } from '../../lib/hooks/useTradingRealtime';

export const PositionsTable: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [positions, setPositions] = useState<PositionDto[]>([]);
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

  // Fetch accounts to determine active account
  const fetchAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !currentOrganization?.id) {
      return null;
    }

    try {
      const orgQuery = `?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`;
      const res = await fetch(`/api/connectors/trading-accounts${orgQuery}`);
      if (!res.ok) throw new Error('Failed to fetch accounts');
      
      const data = await res.json();
      const accounts: TradingAccountDto[] = Array.isArray(data) ? data : data.data || [];
      setTradingAccounts(accounts);

      let targetAccountId = selectedAccountId;
      if (accounts.length > 0) {
        const isSelectedValid = accounts.some(a => a.id === selectedAccountId);
        if (!isSelectedValid) {
          const defaultAccount = accounts.find(a => a.tradingEnabled) || accounts[0];
          targetAccountId = defaultAccount.id;
          setSelectedAccountId(targetAccountId);
        }
      } else {
        setSelectedAccountId(null);
        targetAccountId = null;
      }
      return targetAccountId;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  }, [currentWorkspace?.id, currentOrganization?.id, selectedAccountId]);

  const fetchPositions = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/portfolio/accounts/${accountId}/positions`);
      if (!res.ok) {
        throw new Error('Failed to retrieve open positions.');
      }
      const data = await res.json();
      const loadedPositions: PositionDto[] = Array.isArray(data) ? data : data.positions || [];
      setPositions(loadedPositions);
      setLastSyncTime(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching positions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncData = useCallback(async () => {
    const accountId = await fetchAccounts();
    await fetchPositions(accountId);
  }, [fetchAccounts, fetchPositions]);

  useEffect(() => {
    setIsLoading(true);
    syncData();
  }, [syncData, isConnected]); // Resync when connection restores

  useEffect(() => {
    if (!lastEvent) return;
    
    if (lastEvent.eventType === 'PositionStateChanged' && (lastEvent.data as any).tradingAccountId === selectedAccountId) {
      const updatedPos = lastEvent.data as PositionDto;
      setPositions(prev => {
        const idx = prev.findIndex(p => p.id === updatedPos.id || (p.brokerTicketId && p.brokerTicketId === updatedPos.brokerTicketId));
        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = { ...newArr[idx], ...updatedPos };
          return newArr;
        }
        return [...prev, updatedPos];
      });
      setLastSyncTime(new Date());
    } else if (lastEvent.eventType === 'PositionClosed' && (lastEvent.data as any).tradingAccountId === selectedAccountId) {
      const closedPos = lastEvent.data as { brokerTicketId?: string; positionId: string };
      setPositions(prev => prev.filter(p => p.id !== closedPos.positionId && (!p.brokerTicketId || p.brokerTicketId !== closedPos.brokerTicketId)));
      setLastSyncTime(new Date());
    }
  }, [lastEvent, selectedAccountId]);

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
  if (isLoading && positions.length === 0) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="40px" />
            <Skeleton height="40px" />
            <Skeleton height="40px" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (error && positions.length === 0) {
    return (
      <Alert type="error" title="Positions Sync Failed">
        {error} 
        <Button variant="secondary" size="sm" onClick={() => syncData()} style={{ marginLeft: '12px' }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Card bordered>
      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CardTitle>Open Positions</CardTitle>
          <Badge variant="neutral" size="sm">{positions.length}</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Last Sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : '--:--:--'}
          </div>
          <Button variant="secondary" size="sm" onClick={() => syncData()} isLoading={isLoading && positions.length > 0}>
            ↻
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {tradingAccounts.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
             No trading account connected. Please connect an account to view positions.
           </div>
        ) : positions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
            No open positions.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Symbol</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Side</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Volume</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Entry Price</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Floating PnL</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {pos.symbol || pos.symbolId}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge variant={pos.side?.toUpperCase() === 'BUY' ? 'success' : 'danger'} size="sm">
                        {pos.side?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{pos.quantity}</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{pos.averageEntryPrice}</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: getPnLColor(pos.unrealizedPnl) }}>
                      {formatPnL(pos.unrealizedPnl)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{pos.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
