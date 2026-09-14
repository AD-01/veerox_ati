'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert } from '@veerox/ui';
import { LicenseDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface SuspendLicenseModalProps {
  license: LicenseDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SuspendLicenseModal: React.FC<SuspendLicenseModalProps> = ({
  license,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [reason, setReason] = useState('Temporary administrative pause');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!license) return null;

  const handleSuspend = async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/licensing/licenses/${license.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
          reason: reason.trim() || 'Administrative suspension',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to suspend license');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'warning',
        title: 'License Suspended',
        message: `License #${license.id.substring(0, 8)} has been suspended. Algorithm execution will be paused.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during suspension.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Suspend Cryptographic License"
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSuspend} isLoading={isLoading}>
            Confirm Suspension
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Suspension Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert type="warning" title="Execution Interruption Warning">
          Suspending this license will immediately revoke runtime authorization on all MT5 connectors and execution agents bound to workspace{' '}
          <strong>{currentWorkspace?.name}</strong>.
        </Alert>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Suspension Reason
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
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
          />
        </div>
      </div>
    </Modal>
  );
};
