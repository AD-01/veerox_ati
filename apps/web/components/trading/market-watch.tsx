'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Alert, Skeleton } from '@veerox/ui';
import { useWorkspace } from '../../lib/context/workspace-context';

export interface MarketQuoteDto {
  symbolId: string;
  brokerSymbol: string;
  standardSymbol: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: string;
}

export const MarketWatch: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [quotes, setQuotes] = useState<MarketQuoteDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async (signal: AbortSignal) => {
    if (!currentWorkspace?.id) {
      setQuotes([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/market/workspaces/${currentWorkspace.id}/market/quotes`, { signal });
      if (!res.ok) {
        throw new Error('Failed to fetch market quotes.');
      }
      const data = await res.json();
      const loadedQuotes: MarketQuoteDto[] = Array.isArray(data) ? data : data.data || [];
      setQuotes(loadedQuotes);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'An error occurred while fetching quotes.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const controller = new AbortController();
    
    // Remediation: Clear previous workspace's quotes to prevent tenant data leak during fetch
    setQuotes([]);
    setIsLoading(true);
    fetchQuotes(controller.signal);

    const interval = setInterval(() => {
      fetchQuotes(controller.signal);
    }, 10000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchQuotes]);

  const formatPrice = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(Number(value)) || !isFinite(Number(value))) {
      return '--';
    }
    return Number(value).toString();
  };

  const formatSpread = (value: number | undefined | null) => {
    if (value === undefined || value === null || Number.isNaN(Number(value)) || !isFinite(Number(value))) {
      return '--';
    }
    // Convert mathematical spread to a readable string format to avoid long floating point strings
    return Number(Number(value).toFixed(5)).toString();
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--:--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '--:--:--';
      return d.toLocaleTimeString();
    } catch {
      return '--:--:--';
    }
  };

  if (isLoading && quotes.length === 0) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Market Watch</CardTitle>
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

  if (error && quotes.length === 0) {
    return (
      <Alert type="error" title="Market Data Unavailable">
        {error}
      </Alert>
    );
  }

  return (
    <Card bordered>
      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CardTitle>Market Watch</CardTitle>
          <Badge variant="neutral" size="sm">{quotes.length}</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {quotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
            No Market Data Available
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Symbol</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Broker Symbol</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Bid</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Ask</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Spread</th>
                  <th style={{ padding: '12px 8px', fontWeight: 600 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.symbolId} style={{ borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {quote.standardSymbol}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
                      {quote.brokerSymbol}
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>
                      {formatPrice(quote.bid)}
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)' }}>
                      {formatPrice(quote.ask)}
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                      {formatSpread(quote.spread)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Updated {formatTime(quote.timestamp)}
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
