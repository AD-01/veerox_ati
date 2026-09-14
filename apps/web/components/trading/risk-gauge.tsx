'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Alert, Skeleton, Gauge, Progress } from '@veerox/ui';
import { RiskUtilizationDto, TradingAccountDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';

export const RiskGauge: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<RiskUtilizationDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!currentWorkspace?.id || !currentOrganization?.id) {
      return null;
    }

    try {
      const orgQuery = `?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`;
      const res = await fetch(`/api/connectors/trading-accounts${orgQuery}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      
      const data = await res.json();
      const accounts: TradingAccountDto[] = Array.isArray(data) ? data : data.data || [];

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
      if (err.name === 'AbortError') return null;
      console.error(err);
      return null;
    }
  }, [currentWorkspace?.id, currentOrganization?.id, selectedAccountId]);

  const fetchRiskData = useCallback(async (accountId: string | null, signal?: AbortSignal) => {
    if (!accountId || !currentWorkspace?.id) {
      setRiskData(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/risk/workspaces/${currentWorkspace.id}/accounts/${accountId}/risk-utilization`, { signal });
      if (!res.ok) {
        throw new Error('Failed to retrieve risk utilization telemetry.');
      }
      const data: RiskUtilizationDto = await res.json();
      setRiskData(data);
      setLastSyncTime(new Date());
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'An error occurred while fetching risk metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const controller = new AbortController();
    
    const syncData = async () => {
      setIsLoading(true);
      const accountId = await fetchAccounts(controller.signal);
      await fetchRiskData(accountId, controller.signal);
    };

    syncData();

    const interval = setInterval(async () => {
      const accountId = await fetchAccounts(controller.signal);
      await fetchRiskData(accountId, controller.signal);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchAccounts, fetchRiskData]);

  // Safe division handling function
  const calculateUtilization = (current: number | undefined, limit: number | undefined): number => {
    const safeCurrent = typeof current === 'number' && !isNaN(current) && isFinite(current) ? Math.max(0, current) : 0;
    const safeLimit = typeof limit === 'number' && !isNaN(limit) && isFinite(limit) ? Math.max(0, limit) : 0;
    
    if (safeLimit <= 0) return 0; // prevent division by zero or negative denominator
    
    const util = (safeCurrent / safeLimit) * 100;
    if (isNaN(util) || !isFinite(util)) return 0;
    return Math.min(100, Math.max(0, util)); // Clamp between 0-100
  };

  const mapOutcomeVariant = (outcome: string) => {
    switch (outcome?.toUpperCase()) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      case 'MANUAL_REVIEW': return 'warning';
      case 'UNKNOWN':
      default: return 'neutral';
    }
  };

  const getRiskScoreVariant = (score: number) => {
    if (score < 40) return 'success';
    if (score < 75) return 'warning';
    return 'danger';
  };

  const formatCurrency = (val: number | undefined) => {
    const num = Number(val || 0);
    if (isNaN(num)) return '$0.00';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading && !riskData) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Risk Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
             <Skeleton height="150px" />
             <Skeleton height="150px" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !riskData) {
    return (
      <Alert type="error" title="Risk Telemetry Failed">
        {error}
      </Alert>
    );
  }

  if (!selectedAccountId || !riskData) {
    return (
      <Card glass bordered>
        <CardContent style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: '12px', fontSize: 'var(--text-3xl)' }}>⚖️</div>
          <CardTitle style={{ marginBottom: '8px' }}>No Active Account Risk Data</CardTitle>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px', maxWidth: '400px' }}>
            Risk metrics are not available because no active account is connected to this workspace.
          </p>
        </CardContent>
      </Card>
    );
  }

  const marginUtilPercent = calculateUtilization(riskData.margin?.currentUsed, riskData.margin?.currentEquity);
  const drawdownUtilPercent = calculateUtilization(riskData.drawdown?.current, riskData.drawdown?.limit);

  return (
    <Card bordered>
      <CardHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <CardTitle>Risk Utilization &amp; Safety Limits</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              <div>Last Assessment: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : '--:--:--'}</div>
            </div>
            <Badge variant={mapOutcomeVariant(riskData.decisionOutcome)} size="sm">
              {riskData.decisionOutcome || 'UNKNOWN'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          
          {/* Margin Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Margin Utilization
            </div>
            <Gauge 
              value={marginUtilPercent}
              max={100}
              variant={marginUtilPercent > 80 ? 'danger' : (marginUtilPercent > 50 ? 'warning' : 'brand')}
              size={140}
              strokeWidth={14}
              label={
                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>{formatCurrency(riskData.margin?.currentUsed)}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>of {formatCurrency(riskData.margin?.currentEquity)}</div>
                </div>
              }
            />
          </div>

          {/* Drawdown Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Drawdown Limit
            </div>
            
            <Progress 
              value={drawdownUtilPercent}
              max={100}
              variant={drawdownUtilPercent > 80 ? 'danger' : (drawdownUtilPercent > 50 ? 'warning' : 'brand')}
              size="lg"
              showLabel={true}
              label={<span style={{ color: 'var(--color-text-primary)' }}>Current Drawdown</span>}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Current: {formatCurrency(riskData.drawdown?.current)}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>Limit: {formatCurrency(riskData.drawdown?.limit)}</span>
            </div>
          </div>

          {/* Additional Informational Limits & Score */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '24px' }}>
            
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Risk Score
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {typeof riskData.riskScore === 'number' && !isNaN(riskData.riskScore) ? riskData.riskScore : '--'}
                </span>
                <Badge variant={getRiskScoreVariant(riskData.riskScore)} size="sm">
                  {getRiskScoreVariant(riskData.riskScore).toUpperCase()}
                </Badge>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Daily Loss Limit
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(riskData.dailyLoss?.limit)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Exposure Limit
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(riskData.exposure?.limit)}
              </div>
            </div>

          </div>

        </div>
      </CardContent>
    </Card>
  );
};
