'use client';

import React, { useState } from 'react';
import { Modal, Button, Input, Alert } from '@veerox/ui';
import { ConnectorDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface CreateTradingAccountModalProps {
  connector: ConnectorDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTradingAccountModal: React.FC<CreateTradingAccountModalProps> = ({
  connector,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [brokerName, setBrokerName] = useState('IC Markets');
  const [brokerServer, setBrokerServer] = useState('ICMarketsSC-Live02');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('HEDGING');
  const [leverage, setLeverage] = useState('1:500');
  const [currency, setCurrency] = useState('USD');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!connector) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    if (!accountNumber.trim()) {
      setError('Account number is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/connectors/trading-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
          connectorId: connector.id,
          brokerName: brokerName.trim(),
          brokerServer: brokerServer.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim() || `MT5 Account #${accountNumber.trim()}`,
          accountType,
          leverage,
          currency,
          platform: 'MT5',
          terminalVersion: 'Build 4153',
        }),
      });

      const data = await res.json();

      if (!res.ok || (!data.id && !data.success)) {
        setError(data.error || data.message || 'Failed to attach trading account');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Trading Account Attached',
        message: `Account #${accountNumber} attached to connector "${connector.name}".`,
      });
      setAccountNumber('');
      setAccountName('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Attach MT5 Account to "${connector.name}"`}
      maxWidth="500px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            Attach Account
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {error && (
          <Alert type="error" title="Account Setup Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Broker Name"
          value={brokerName}
          onChange={e => setBrokerName(e.target.value)}
          required
        />

        <Input
          label="Broker Server Name"
          value={brokerServer}
          onChange={e => setBrokerServer(e.target.value)}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            label="Account Number / Login"
            placeholder="e.g. 8829104"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            required
          />

          <Input
            label="Account Friendly Name"
            placeholder="e.g. EURUSD Alpha"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Account Type
            </label>
            <select
              value={accountType}
              onChange={e => setAccountType(e.target.value)}
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
              <option value="HEDGING">Hedging</option>
              <option value="NETTING">Netting</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Leverage
            </label>
            <select
              value={leverage}
              onChange={e => setLeverage(e.target.value)}
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
              <option value="1:100">1:100</option>
              <option value="1:200">1:200</option>
              <option value="1:500">1:500</option>
              <option value="1:1000">1:1000</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};
