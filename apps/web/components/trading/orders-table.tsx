'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { ExecutionOrderDto, TradingAccountDto, EventEnvelope } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useTradingRealtime } from '../../lib/hooks/useTradingRealtime';

export const OrdersTable: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [orders, setOrders] = useState<ExecutionOrderDto[]>([]);
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

  const fetchOrders = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/execution/accounts/${accountId}/orders`);
      if (!res.ok) {
        throw new Error('Failed to retrieve execution orders.');
      }
      const data = await res.json();
      const loadedOrders: ExecutionOrderDto[] = Array.isArray(data) ? data : data.orders || data.data || [];
      setOrders(loadedOrders);
      setLastSyncTime(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching orders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncData = useCallback(async () => {
    const accountId = await fetchAccounts();
    await fetchOrders(accountId);
  }, [fetchAccounts, fetchOrders]);

  useEffect(() => {
    setIsLoading(true);
    syncData();
  }, [syncData, isConnected]); // Resync when connection restores

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.eventType === 'OrderStateChanged' && (lastEvent.data as any).tradingAccountId === selectedAccountId) {
      const updatedOrder = lastEvent.data as ExecutionOrderDto;
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === updatedOrder.id || (o.brokerTicketId && o.brokerTicketId === updatedOrder.brokerTicketId));
        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = { ...newArr[idx], ...updatedOrder };
          return newArr;
        }
        return [updatedOrder, ...prev]; // newer orders at the top
      });
      setLastSyncTime(new Date());
    }
  }, [lastEvent, selectedAccountId]);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (['FILLED', 'COMPLETED', 'DONE'].includes(s)) return <Badge variant="success" size="sm">{s}</Badge>;
    if (['PENDING', 'NEW', 'SUBMITTED', 'ACCEPTED'].includes(s)) return <Badge variant="warning" size="sm">{s}</Badge>;
    if (['REJECTED', 'FAILED', 'CANCELLED'].includes(s)) return <Badge variant="danger" size="sm">{s}</Badge>;
    return <Badge variant="neutral" size="sm">{s}</Badge>;
  };

  const formatDateTime = (val: Date | string) => {
    if (!val) return '--';
    const date = new Date(val);
    return date.toLocaleString();
  };

  // Loading State
  if (isLoading && orders.length === 0) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Execution Orders</CardTitle>
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
  if (error && orders.length === 0) {
    return (
      <Alert type="error" title="Orders Sync Failed">
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
          <CardTitle>Execution Orders</CardTitle>
          <Badge variant="neutral" size="sm">{orders.length}</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Last Sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : '--:--:--'}
          </div>
          <Button variant="secondary" size="sm" onClick={() => syncData()} isLoading={isLoading && orders.length > 0}>
            ↻
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {tradingAccounts.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
             No trading account connected. Please connect an account to view orders.
           </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
            No execution orders found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Order ID</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Symbol</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Side</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Filled</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Req. Price</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {order.id.split('-')[0]}...
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {order.symbol || order.symbolId}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px' }}>{order.orderType}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge variant={order.side?.toUpperCase() === 'BUY' ? 'success' : (order.side?.toUpperCase() === 'SELL' ? 'danger' : 'neutral')} size="sm">
                        {order.side?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{order.size}</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{order.executedSize || 0}</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>{order.requestedPrice || 'MKT'}</td>
                    <td style={{ padding: '12px 8px' }}>
                      {getStatusBadge(order.status)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {formatDateTime(order.createdAt)}
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
