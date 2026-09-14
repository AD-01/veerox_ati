'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Alert, Skeleton } from '@veerox/ui';
import { AccountHistoryPointDto, TradingAccountDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';

export const EquityChart: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [history, setHistory] = useState<AccountHistoryPointDto[]>([]);
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
      if (err.name === 'AbortError') return null;
      console.error(err);
      return null;
    }
  }, [currentWorkspace?.id, currentOrganization?.id, selectedAccountId]);

  const fetchHistory = useCallback(async (accountId: string | null, signal?: AbortSignal) => {
    if (!accountId) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/portfolio/accounts/${accountId}/history`, { signal });
      if (!res.ok) {
        throw new Error('Failed to retrieve equity history.');
      }
      const data = await res.json();
      const loadedHistory: AccountHistoryPointDto[] = Array.isArray(data) ? data : data.history || [];
      setHistory(loadedHistory);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'An error occurred while fetching equity history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    
    const syncData = async () => {
      setIsLoading(true);
      const accountId = await fetchAccounts(controller.signal);
      await fetchHistory(accountId, controller.signal);
    };

    syncData();

    const interval = setInterval(async () => {
      const accountId = await fetchAccounts(controller.signal);
      await fetchHistory(accountId, controller.signal);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchAccounts, fetchHistory]);

  const { pathData, minEquity, maxEquity, viewBoxWidth, viewBoxHeight } = useMemo(() => {
    const w = 800;
    const h = 300;
    
    if (history.length === 0) {
      return { pathData: '', minEquity: 0, maxEquity: 0, viewBoxWidth: w, viewBoxHeight: h };
    }
    
    if (history.length === 1) {
      return { 
        pathData: `M 0,${h/2} L ${w},${h/2}`, 
        minEquity: history[0].equity, 
        maxEquity: history[0].equity, 
        viewBoxWidth: w, 
        viewBoxHeight: h 
      };
    }

    const equities = history.map(h => isNaN(Number(h.equity)) ? 0 : Number(h.equity));
    const minE = Math.min(...equities);
    const maxE = Math.max(...equities);
    const range = maxE - minE || 1; // avoid division by zero
    
    const padding = range * 0.1; // 10% vertical padding
    const adjustedMin = minE - padding;
    const adjustedMax = maxE + padding;
    const adjustedRange = adjustedMax - adjustedMin;

    const points = history.map((pt, index) => {
      const x = (index / (history.length - 1)) * w;
      const y = h - (((Number(pt.equity) || 0) - adjustedMin) / adjustedRange) * h;
      // Handle NaN coordinates
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        return `0,0`;
      }
      return `${x},${y}`;
    });

    const pData = `M ${points.join(' L ')}`;

    return { pathData: pData, minEquity: minE, maxEquity: maxE, viewBoxWidth: w, viewBoxHeight: h };
  }, [history]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || history.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percent * (history.length - 1));
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    if (isNaN(num)) return '$0.00';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading && history.length === 0) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Portfolio Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton height="300px" />
        </CardContent>
      </Card>
    );
  }

  if (error && history.length === 0) {
    return (
      <Alert type="error" title="Equity Curve Failed">
        {error}
      </Alert>
    );
  }

  return (
    <Card bordered>
      <CardHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>Portfolio Equity Curve</CardTitle>
          {hoverIndex !== null && history[hoverIndex] && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', marginRight: '4px' }}>Time:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(history[hoverIndex].timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', marginRight: '4px' }}>Equity:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(history[hoverIndex].equity)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tradingAccounts.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--color-text-muted)' }}>
             No trading account connected. Please connect an account to view equity history.
           </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--color-text-muted)' }}>
            No historical equity data available for this account.
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '300px' }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%', overflow: 'visible', cursor: 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Grid lines */}
              <line x1="0" y1="0" x2={viewBoxWidth} y2="0" stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1={viewBoxHeight/2} x2={viewBoxWidth} y2={viewBoxHeight/2} stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1={viewBoxHeight} x2={viewBoxWidth} y2={viewBoxHeight} stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Equity Path */}
              <path
                d={pathData}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hover Indicator */}
              {hoverIndex !== null && history.length > 1 && (
                <g>
                  <line 
                    x1={(hoverIndex / (history.length - 1)) * viewBoxWidth} 
                    y1="0" 
                    x2={(hoverIndex / (history.length - 1)) * viewBoxWidth} 
                    y2={viewBoxHeight} 
                    stroke="var(--color-border-subtle)" 
                    strokeWidth="1" 
                  />
                  <circle
                    cx={(hoverIndex / (history.length - 1)) * viewBoxWidth}
                    cy={
                      viewBoxHeight - 
                      (((Number(history[hoverIndex].equity) || 0) - (minEquity - (maxEquity - minEquity || 1) * 0.1)) / 
                      ((maxEquity + (maxEquity - minEquity || 1) * 0.1) - (minEquity - (maxEquity - minEquity || 1) * 0.1))) * viewBoxHeight
                    }
                    r="4"
                    fill="var(--color-background)"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {formatCurrency(maxEquity)}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {formatCurrency(minEquity)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
