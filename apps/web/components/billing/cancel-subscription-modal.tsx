'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert } from '@veerox/ui';
import { SubscriptionDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface CancelSubscriptionModalProps {
  subscription: SubscriptionDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  subscription,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!subscription) return null;

  const handleCancel = async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/billing/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to cancel subscription');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'warning',
        title: 'Subscription Canceled',
        message: `Subscription ${subscription.id} has been canceled.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during cancellation.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Subscription"
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Keep Subscription
          </Button>
          <Button variant="danger" onClick={handleCancel} isLoading={isLoading}>
            Confirm Cancellation
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Cancellation Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert type="warning" title="Warning: Deprovisioning Risk">
          Canceling this subscription will deactivate the associated product license for workspace{' '}
          <strong>{currentWorkspace?.name}</strong> at the end of the billing period.
        </Alert>

        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--text-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Subscription ID:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{subscription.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Billing Period:</span>
            <span>{subscription.billingPeriod}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Current Status:</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{subscription.status}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
