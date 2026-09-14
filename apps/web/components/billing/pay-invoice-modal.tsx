'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert, Badge } from '@veerox/ui';
import { InvoiceDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface PayInvoiceModalProps {
  invoice: InvoiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invoice) return null;

  const handlePay = async () => {
    if (!currentOrganization?.id || !currentWorkspace?.id) {
      setError('Active organization or workspace not found.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idempotencyKey = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch(`/api/billing/invoices/${invoice.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Payment processing failed');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Invoice Settled',
        message: `Invoice #${invoice.id.substring(0, 8)} of $${Number(invoice.amount).toFixed(2)} ${invoice.currency} has been paid successfully.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during payment.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Outstanding Invoice"
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePay} isLoading={isLoading}>
            Confirm Payment (${Number(invoice.amount).toFixed(2)})
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Payment Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Invoice Number</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-brand-cyan)' }}>
              #{invoice.id.substring(0, 13)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Total Amount</span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(invoice.amount).toFixed(2)} {invoice.currency}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Status</span>
            <Badge variant="warning" size="sm">
              {invoice.status}
            </Badge>
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          Payment will be processed and credited to the workspace accounting ledger with full cryptographic audit trails.
        </div>
      </div>
    </Modal>
  );
};
