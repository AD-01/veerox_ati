'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert, Spinner } from '@veerox/ui';
import { ConnectorDto, ProvisionConnectorResponseDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface ProvisionAgentModalProps {
  connector: ConnectorDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProvisionAgentModal: React.FC<ProvisionAgentModalProps> = ({
  connector,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [provisionData, setProvisionData] = useState<ProvisionConnectorResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!connector) return null;

  const handleProvision = async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/connectors/${connector.id}/credentials/provision?organizationId=${currentOrganization.id}&workspaceId=${currentWorkspace.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.secret) {
        setError(data.error || data.message || 'Provisioning failed');
        setIsLoading(false);
        return;
      }

      setProvisionData({
        connectorId: connector.id,
        agentId: connector.agentId || 'pending-registration',
        agentSecret: data.secret,
      });
      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Agent Provisioned',
        message: `Agent credentials generated successfully.`,
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'An error occurred during agent provisioning.');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setProvisionData(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={provisionData ? 'Agent Provisioning Complete' : `Provision Agent for "${connector.name}"`}
      maxWidth="540px"
      footer={
        provisionData ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleProvision} isLoading={isLoading}>
              Generate Agent Credentials
            </Button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Provisioning Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {provisionData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Alert type="warning" title="One-Time Secret Revelation">
              Please copy the agent secret below. It will NEVER be shown again after you close this window.
            </Alert>

            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Agent Secret:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {provisionData.agentSecret}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(provisionData.agentSecret || '');
                      showToast({ type: 'success', title: 'Copied', message: 'Secret copied to clipboard' });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Agent ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {provisionData.agentId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Connector ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{provisionData.connectorId}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                MT5 VPS Bridge Startup Command
              </span>
              <pre
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface-base)',
                  border: '1px solid var(--color-border-muted)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-primary)',
                  overflowX: 'auto',
                }}
              >
                {`npx @veerox/agent start \\\n  --connector-id ${provisionData.connectorId} \\\n  --workspace-id ${currentWorkspace?.id} \\\n  --secret ${provisionData.agentSecret}`}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
              Provisioning will assign a dedicated machine agent UUID and generate cryptographic authentication credentials for your remote MT5 terminal.
            </p>

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--text-xs)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Target Workspace:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{currentWorkspace?.name}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
