'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert, Badge, Skeleton } from '@veerox/ui';
import { ConnectorDto, ConnectorCommandDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';

interface CommandPanelProps {
  connectors: ConnectorDto[];
}

export function CommandPanel({ connectors }: CommandPanelProps) {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    connectors.length > 0 ? connectors[0].id : null
  );

  const [commands, setCommands] = useState<ConnectorCommandDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [commandType, setCommandType] = useState('DEPLOY_EA');
  const [payloadStr, setPayloadStr] = useState('{\n  "eaName": "ExampleEA",\n  "version": "1.0.0"\n}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedConnectorId && connectors.length > 0) {
      setSelectedConnectorId(connectors[0].id);
    }
  }, [connectors, selectedConnectorId]);

  useEffect(() => {
    if (!selectedConnectorId || !currentOrganization?.id || !currentWorkspace?.id) {
      return;
    }

    const abortController = new AbortController();

    const fetchCommands = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/connectors/${selectedConnectorId}/commands?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}&limit=100`,
          { signal: abortController.signal }
        );
        if (res.ok) {
          const json = await res.json();
          if (!abortController.signal.aborted) {
            setCommands(json.data || []);
          }
        } else {
          if (!abortController.signal.aborted) setCommands([]);
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) setCommands([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchCommands();
    const interval = setInterval(fetchCommands, 10000);

    return () => {
      abortController.abort();
      clearInterval(interval);
      setCommands([]);
    };
  }, [selectedConnectorId, currentOrganization?.id, currentWorkspace?.id]);

  const handleDispatch = async () => {
    if (!selectedConnectorId || !currentOrganization?.id || !currentWorkspace?.id) return;

    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      // Validate JSON
      JSON.parse(payloadStr);

      const res = await fetch(
        `/api/connectors/${selectedConnectorId}/commands?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commandType,
            payloadJson: payloadStr
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to dispatch command');
      }

      setSubmitSuccess('Command dispatched successfully.');
      
      // trigger immediate fetch
      const refreshRes = await fetch(
        `/api/connectors/${selectedConnectorId}/commands?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}&limit=100`
      );
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setCommands(json.data || []);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while dispatching');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="info" size="sm">PENDING</Badge>;
      case 'PROCESSED': return <Badge variant="success" size="sm">PROCESSED</Badge>;
      case 'FAILED': return <Badge variant="danger" size="sm">FAILED</Badge>;
      default: return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Select Connector:</label>
        <select
          value={selectedConnectorId || ''}
          onChange={(e) => setSelectedConnectorId(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-muted)',
            fontSize: 'var(--text-sm)'
          }}
        >
          {connectors.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
          ))}
          {connectors.length === 0 && <option value="">No Connectors Available</option>}
        </select>
      </div>

      {connectors.length === 0 ? (
        <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔌</div>
          <CardTitle>No Connectors Registered</CardTitle>
          <CardDescription>Register a connector to deploy EAs.</CardDescription>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          
          {/* Dispatch Panel */}
          <Card glass bordered>
            <CardHeader>
              <CardTitle>Dispatch Command</CardTitle>
              <CardDescription>Deploy EAs or send commands to the selected node</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {submitError && <Alert type="error" title="Dispatch Failed" onClose={() => setSubmitError(null)}>{submitError}</Alert>}
                {submitSuccess && <Alert type="success" title="Success" onClose={() => setSubmitSuccess(null)}>{submitSuccess}</Alert>}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Command Type</label>
                  <select
                    value={commandType}
                    onChange={(e) => setCommandType(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-muted)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <option value="DEPLOY_EA">DEPLOY_EA</option>
                    <option value="RAW">RAW</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Payload (JSON)</label>
                  <textarea
                    value={payloadStr}
                    onChange={(e) => setPayloadStr(e.target.value)}
                    rows={6}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-muted)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <Button 
                  variant="primary" 
                  onClick={handleDispatch} 
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  style={{ marginTop: '8px' }}
                >
                  Dispatch Command
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* History Panel */}
          <Card glass bordered style={{ gridColumn: 'auto / span 2' }}>
            <CardHeader>
              <CardTitle>Command History</CardTitle>
              <CardDescription>Latest 100 commands for this connector</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory && commands.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   <Skeleton height="60px" />
                   <Skeleton height="60px" />
                </div>
              ) : commands.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No commands have been issued for this connector.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {commands.map(cmd => (
                    <div key={cmd.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-hover)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{cmd.commandType}</span>
                          {renderStatus(cmd.status)}
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            Seq: {cmd.sequenceNumber}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {typeof cmd.payloadJson === 'string' ? cmd.payloadJson : JSON.stringify(cmd.payloadJson)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Created: {new Date(cmd.createdAt).toLocaleString()}
                        </span>
                        {cmd.updatedAt && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            Updated: {new Date(cmd.updatedAt).toLocaleString()}
                          </span>
                        )}
                        {cmd.clientExecutionId && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                            ExecID: {cmd.clientExecutionId}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
