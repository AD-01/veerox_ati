'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Alert, Skeleton } from '@veerox/ui';
import { useWorkspace } from '../../lib/context/workspace-context';
import { StrategyStatusDto } from '@veerox/contracts';

export const StrategyStatus: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [strategies, setStrategies] = useState<StrategyStatusDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async (signal: AbortSignal) => {
    if (!currentWorkspace?.id) {
      setStrategies([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/strategy/workspaces/${currentWorkspace.id}/strategies/status`, { signal });
      if (!res.ok) {
        throw new Error('Failed to fetch strategy status.');
      }
      const data = await res.json();
      const loadedStrategies: StrategyStatusDto[] = Array.isArray(data) ? data : data.data || [];
      setStrategies(loadedStrategies);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'An error occurred while fetching strategies.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const controller = new AbortController();
    
    // Clear previous workspace's state to prevent tenant data leak
    setStrategies([]);
    setIsLoading(true);
    fetchStrategies(controller.signal);

    const interval = setInterval(() => {
      fetchStrategies(controller.signal);
    }, 10000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchStrategies]);

  const formatTime = (isoString: Date | string | undefined | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString();
    } catch {
      return '—';
    }
  };

  const mapStatusToVariant = (status: string): "success" | "warning" | "danger" | "neutral" | "info" | "brand" => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') return 'success';
    if (s === 'PAUSED') return 'warning';
    if (s === 'DRAFT') return 'neutral';
    if (s === 'STOPPED') return 'danger';
    return 'neutral'; // Neutral fallback for unknown status
  };

  if (isLoading && strategies.length === 0) {
    return (
      <Card bordered>
        <CardHeader>
          <CardTitle>Strategy Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton height="60px" />
            <Skeleton height="40px" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && strategies.length === 0) {
    return (
      <Alert type="error" title="Strategy Status Unavailable">
        {error}
      </Alert>
    );
  }

  const currentStrategy = strategies.find(s => s.isCurrent);
  const otherStrategies = strategies.filter(s => !s.isCurrent);

  return (
    <Card bordered>
      <CardHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CardTitle>Strategy Status</CardTitle>
          <Badge variant="neutral" size="sm">{strategies.length}</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {strategies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
            No Strategies Available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Current Strategy Section */}
            {currentStrategy && (
              <div>
                <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Current Strategy
                </h4>
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {currentStrategy.name}
                    </span>
                    <Badge variant="success" size="sm">CURRENT</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Badge variant={mapStatusToVariant(currentStrategy.status)} size="sm">{currentStrategy.status}</Badge>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                      Updated: {formatTime(currentStrategy.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Other Strategies Section */}
            {otherStrategies.length > 0 && (
              <div>
                {currentStrategy && (
                  <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-subtle)', margin: '0 0 16px 0' }} />
                )}
                <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Other Strategies
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '8px', fontWeight: 600 }}>Strategy Name</th>
                        <th style={{ padding: '8px', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '8px', fontWeight: 600 }}>Current</th>
                        <th style={{ padding: '8px', fontWeight: 600 }}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherStrategies.map((strat) => (
                        <tr key={strat.strategyId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {strat.name}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <Badge variant={mapStatusToVariant(strat.status)} size="sm">{strat.status}</Badge>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>
                            —
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>
                            {formatTime(strat.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
