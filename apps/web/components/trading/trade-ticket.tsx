'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Alert, Badge } from '@veerox/ui';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useTradingRealtime } from '../../lib/hooks/useTradingRealtime';
import { TradingAccountDto, MarketQuoteDto, ExecutionOrderDto, SubmitManualTradeRequestDto } from '@veerox/contracts';

type TicketState = 'IDLE' | 'SUBMITTING' | 'PENDING_EXECUTION' | 'EXECUTED' | 'REJECTED' | 'FAILED' | 'UNKNOWN';

export const TradeTicket: React.FC = () => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState<TradingAccountDto[]>([]);
  const [quotes, setQuotes] = useState<MarketQuoteDto[]>([]);
  
  // Form State
  const [accountId, setAccountId] = useState<string>('');
  const [symbolId, setSymbolId] = useState<string>('');
  const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [volume, setVolume] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  
  // Submission State
  const [ticketState, setTicketState] = useState<TicketState>('IDLE');
  const [clientExecutionId, setClientExecutionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { lastEvent } = useTradingRealtime({
    organizationId: currentOrganization?.id,
    workspaceId: currentWorkspace?.id,
    enabled: true,
  });

  // Fetch Accounts
  useEffect(() => {
    if (!currentOrganization?.id || !currentWorkspace?.id) return;
    
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`/api/connectors/trading-accounts?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`);
        if (res.ok) {
          const data = await res.json();
          const accs = Array.isArray(data) ? data : data.data || [];
          setAccounts(accs);
          if (accs.length > 0 && !accountId) {
            const defaultAcc = accs.find((a: TradingAccountDto) => a.tradingEnabled) || accs[0];
            setAccountId(defaultAcc.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch accounts for Trade Ticket', err);
      }
    };
    fetchAccounts();
  }, [currentOrganization?.id, currentWorkspace?.id]);

  // Fetch Quotes
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchQuotes = async () => {
      try {
        const res = await fetch(`/api/market/workspaces/${currentWorkspace.id}/market/quotes`);
        if (res.ok) {
          const data = await res.json();
          const qts = Array.isArray(data) ? data : data.data || [];
          setQuotes(qts);
          if (qts.length > 0 && !symbolId) {
            setSymbolId(qts[0].symbolId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch quotes for Trade Ticket', err);
      }
    };
    
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000);
    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  // Real-time Event Correlation
  useEffect(() => {
    if (!lastEvent || !clientExecutionId) return;

    if (lastEvent.eventType === 'OrderStateChanged' && (ticketState === 'SUBMITTING' || ticketState === 'PENDING_EXECUTION')) {
      const order = lastEvent.data as ExecutionOrderDto;
      if (order.correlationId === clientExecutionId) {
        const status = order.status.toUpperCase();
        if (['FILLED', 'COMPLETED', 'DONE'].includes(status)) {
          setTicketState('EXECUTED');
        } else if (['REJECTED'].includes(status)) {
          setTicketState('REJECTED');
          setErrorMessage(order.failureReason || 'Trade rejected by Risk Engine or Broker');
        } else if (['FAILED', 'CANCELLED'].includes(status)) {
          setTicketState('FAILED');
          setErrorMessage(order.failureReason || 'Trade execution failed');
        } else if (['PENDING', 'NEW', 'SUBMITTED', 'ACCEPTED'].includes(status)) {
          setTicketState('PENDING_EXECUTION');
        }
      }
    }
  }, [lastEvent, clientExecutionId, ticketState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !symbolId || !volume) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }
    
    const volNum = parseFloat(volume);
    if (isNaN(volNum) || volNum <= 0) {
      setErrorMessage('Volume must be a positive number.');
      return;
    }

    setErrorMessage(null);
    setTicketState('SUBMITTING');
    const newExecId = crypto.randomUUID();
    setClientExecutionId(newExecId);

    const payload: SubmitManualTradeRequestDto = {
      accountId,
      symbolId,
      tradeDirection,
      requestedSize: volNum,
      orderType: 'MARKET',
      clientExecutionId: newExecId,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    };

    try {
      const res = await fetch(`/api/execution/workspaces/${currentWorkspace?.id}/accounts/${accountId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 400) {
          setErrorMessage('Invalid trade request. Please check inputs.');
          setTicketState('FAILED');
        } else if (res.status === 401) {
          setErrorMessage('Unauthorized. Your session may have expired.');
          setTicketState('FAILED');
        } else if (res.status === 403) {
          setErrorMessage('Permission denied. You do not have access to trade on this account.');
          setTicketState('FAILED');
        } else if (res.status === 409) {
          // Idempotency conflict, we might have successfully submitted this ID previously
          setTicketState('PENDING_EXECUTION');
        } else {
          setErrorMessage(`Execution infrastructure error: ${res.status}`);
          setTicketState('UNKNOWN');
        }
        return;
      }

      setTicketState('PENDING_EXECUTION');
      
    } catch (err: any) {
      setErrorMessage(err.message || 'Network timeout or failure. Status unknown - waiting for execution state.');
      setTicketState('UNKNOWN');
    }
  };

  const resetTicket = () => {
    setTicketState('IDLE');
    setClientExecutionId('');
    setErrorMessage(null);
    setVolume('');
  };

  const isLocked = ticketState === 'SUBMITTING' || ticketState === 'PENDING_EXECUTION' || ticketState === 'UNKNOWN';
  
  const currentSymbolName = useMemo(() => {
    const s = quotes.find(q => q.symbolId === symbolId);
    return s ? s.standardSymbol || s.brokerSymbol : symbolId;
  }, [quotes, symbolId]);

  return (
    <Card bordered>
      <CardHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '16px', marginBottom: '16px' }}>
        <CardTitle>Trade Ticket</CardTitle>
      </CardHeader>
      
      <CardContent>
        {errorMessage && (
          <div style={{ marginBottom: '16px' }}>
             <Alert type="error" title="Trade Error">{errorMessage}</Alert>
          </div>
        )}

        {(ticketState === 'EXECUTED' || ticketState === 'REJECTED' || ticketState === 'FAILED') ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {ticketState === 'EXECUTED' ? '✅' : '❌'}
            </div>
            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '8px', color: ticketState === 'EXECUTED' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {ticketState === 'EXECUTED' ? 'Trade Executed' : `Trade ${ticketState === 'REJECTED' ? 'Rejected' : 'Failed'}`}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              {tradeDirection} {volume} {currentSymbolName}
            </p>
            <Button variant="primary" onClick={resetTicket}>
              New Trade
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Account Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Account</label>
              <select 
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={isLocked || accounts.length === 0}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                {accounts.length === 0 ? (
                  <option value="">No Accounts Available</option>
                ) : (
                  accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName || acc.accountNumber} ({acc.brokerName}) {acc.tradingEnabled ? '' : '[DISABLED]'}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Symbol Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Symbol</label>
              <select 
                value={symbolId}
                onChange={(e) => setSymbolId(e.target.value)}
                disabled={isLocked || quotes.length === 0}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                {quotes.length === 0 ? (
                  <option value="">No Market Data Available</option>
                ) : (
                  quotes.map(q => (
                    <option key={q.symbolId} value={q.symbolId}>
                      {q.standardSymbol || q.brokerSymbol} — {q.bid}/{q.ask}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Side Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Button 
                type="button"
                variant={tradeDirection === 'BUY' ? 'primary' : 'secondary'}
                onClick={() => setTradeDirection('BUY')}
                disabled={isLocked}
                style={{ 
                  backgroundColor: tradeDirection === 'BUY' ? 'var(--color-success)' : undefined,
                  color: tradeDirection === 'BUY' ? '#fff' : undefined,
                  borderColor: tradeDirection === 'BUY' ? 'var(--color-success)' : undefined
                }}
              >
                BUY
              </Button>
              <Button 
                type="button"
                variant={tradeDirection === 'SELL' ? 'primary' : 'secondary'}
                onClick={() => setTradeDirection('SELL')}
                disabled={isLocked}
                style={{ 
                  backgroundColor: tradeDirection === 'SELL' ? 'var(--color-danger)' : undefined,
                  color: tradeDirection === 'SELL' ? '#fff' : undefined,
                  borderColor: tradeDirection === 'SELL' ? 'var(--color-danger)' : undefined
                }}
              >
                SELL
              </Button>
            </div>

            {/* Volume Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="ticket-volume" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Volume (Lots)</label>
              <input
                id="ticket-volume"
                type="number"
                step="0.01"
                min="0.01"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                disabled={isLocked}
                placeholder="e.g. 1.5"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Stop Loss (Optional) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label htmlFor="ticket-sl" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>SL (Optional)</label>
                <input
                  id="ticket-sl"
                  type="number"
                  step="0.00001"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  disabled={isLocked}
                  placeholder="Price"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                />
              </div>

              {/* Take Profit (Optional) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label htmlFor="ticket-tp" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>TP (Optional)</label>
                <input
                  id="ticket-tp"
                  type="number"
                  step="0.00001"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  disabled={isLocked}
                  placeholder="Price"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                />
              </div>
            </div>

            {/* Submission Button */}
            <div style={{ marginTop: '16px' }}>
              <Button 
                type="submit" 
                variant="primary" 
                size="md" 
                style={{ width: '100%', padding: '12px' }}
                disabled={isLocked || !accountId || !symbolId || !volume}
                isLoading={isLocked}
              >
                {ticketState === 'SUBMITTING' ? 'Submitting...' : 
                 ticketState === 'PENDING_EXECUTION' ? 'Pending Execution...' : 
                 ticketState === 'UNKNOWN' ? 'Waiting for sync...' : 'Submit Trade'}
              </Button>
            </div>
            
            {ticketState === 'PENDING_EXECUTION' && (
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Order accepted by Risk Engine. Waiting for broker execution...
              </div>
            )}
            
          </form>
        )}
      </CardContent>
    </Card>
  );
};
