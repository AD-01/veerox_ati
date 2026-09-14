'use client';

import React, { useState } from 'react';
import { Modal, Button, Input, Alert } from '@veerox/ui';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface CreateConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateConnectorModal: React.FC<CreateConnectorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('MT5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    if (!name.trim()) {
      setError('Connector name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
          name: name.trim(),
          provider,
        }),
      });

      const data = await res.json();

      if (!res.ok || (!data.id && !data.success)) {
        setError(data.error || data.message || 'Failed to create connector');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Connector Registered',
        message: `Connector "${name}" registered for workspace ${currentWorkspace.name}.`,
      });
      setName('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register MT5 / Gateway Connector Node"
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            Register Node
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Registration Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Connector Node Name"
          placeholder="e.g. London Equinix LD4 - MT5 VPS #1"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Gateway Provider
          </label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={{
              height: '42px',
              backgroundColor: 'var(--color-surface-input)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-muted)',
              outline: 'none',
            }}
          >
            <option value="MT5">MetaTrader 5 (MT5 Agent Gateway)</option>
            <option value="CTRADER">cTrader Open API Bridge</option>
            <option value="FIX">FIX 4.4 Financial Exchange Protocol</option>
          </select>
        </div>
      </form>
    </Modal>
  );
};
