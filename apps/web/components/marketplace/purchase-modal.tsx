'use client';

import React, { useState } from 'react';
import { Modal, Button, Badge, Alert } from '@veerox/ui';
import { MarketplaceProductDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface PurchaseModalProps {
  product: MarketplaceProductDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);

  if (!product) return null;

  const handlePurchase = async () => {
    if (!currentWorkspace?.id || !currentOrganization?.id) {
      setError('Active workspace or organization not selected. Please select one in the topbar.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idempotencyKey = `pur-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch(`/api/marketplace/products/${product.id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          organizationId: currentOrganization.id,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to complete purchase');
        setIsLoading(false);
        return;
      }

      setPurchaseSuccess(true);
      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Purchase Successful',
        message: `Successfully subscribed to "${product.name}". License issued to ${currentWorkspace.name}.`,
      });

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during purchase.');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setPurchaseSuccess(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={purchaseSuccess ? 'License Issued & Active' : 'Deploy & License Strategy'}
      maxWidth="540px"
      footer={
        purchaseSuccess ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePurchase} isLoading={isLoading}>
              Confirm Deployment & Purchase
            </Button>
          </>
        )
      }
    >
      {purchaseSuccess ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '12px 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success-bg)',
              border: '2px solid var(--color-success)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto',
            }}
          >
            ✓
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              License Active for {currentWorkspace?.name}
            </h4>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Your commercial subscription has been activated and an Ed25519 cryptographic license is now registered.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <Alert type="error" title="Purchase Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Product Summary Box */}
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
              <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                {product.name}
              </span>
              <Badge variant="brand" size="sm">
                {product.productType}
              </Badge>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              {product.description || 'No description provided.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Pricing Model:</span>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-brand-cyan)' }}>
                ${Number(product.price).toFixed(2)} {product.currency}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  {' '}/ {product.pricingModel}
                </span>
              </span>
            </div>
          </div>

          {/* Tenant Target Confirmation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Deployment Target
            </span>
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-input)',
                border: '1px solid var(--color-border-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>Target Workspace:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {currentWorkspace?.name || 'Default Workspace'}
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
