'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert } from '@veerox/ui';
import { LicenseDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface RevokeLicenseModalProps {
  license: LicenseDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RevokeLicenseModal: React.FC<RevokeLicenseModalProps> = ({
  license,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [reason, setReason] = useState('Permanent compliance revocation');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!license) return null;

  const handleRevoke = async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/licensing/licenses/${license.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
          reason: reason.trim() || 'Permanent revocation',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to revoke license');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'error',
        title: 'License Permanently Revoked',
        message: `License #${license.id.substring(0, 8)} has been revoked. This action is irreversible.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during revocation.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Permanently Revoke License"
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRevoke} isLoading={isLoading}>
            Revoke Permanently
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Revocation Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert type="error" title="Irreversible Action">
          Permanent revocation permanently invalidates cryptographic Ed25519 authorization keys. This license cannot be reactivated.
        </Alert>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Revocation Reason
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
