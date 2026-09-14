'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Alert, Spinner } from '@veerox/ui';
import { LicenseDto } from '@veerox/contracts';
import { useWorkspace } from '../../lib/context/workspace-context';

export interface ValidateLicenseModalProps {
  license: LicenseDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ValidateLicenseModal: React.FC<ValidateLicenseModalProps> = ({
  license,
  isOpen,
  onClose,
}) => {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationData, setValidationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !license || !currentWorkspace?.id) return;

    let isMounted = true;
    setIsValidating(true);
    setError(null);
    setValidationData(null);

    const runValidation = async () => {
      try {
        const res = await fetch('/api/licensing/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspace.id,
            productId: license.productId,
            licenseId: license.id,
            organizationId: currentOrganization?.id || license.organizationId,
          }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.success) {
          setError(data.error || data.message || 'Validation request failed');
          setIsValidating(false);
          return;
        }

        setValidationData(data.data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Network error during validation');
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    runValidation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, license, currentWorkspace?.id, currentOrganization?.id]);

  if (!license) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cryptographic Signature Verification"
      maxWidth="520px"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close Verification Audit
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {error && (
          <Alert type="error" title="Validation Error">
            {error}
          </Alert>
        )}

        {isValidating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px 0' }}>
            <Spinner size="lg" />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Verifying Ed25519 signature with licensing cluster...
            </span>
          </div>
        )}

        {!isValidating && validationData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Indicator Banner */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: validationData.valid ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                border: `1px solid ${validationData.valid ? 'var(--color-success)' : 'var(--color-danger)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: validationData.valid ? 'var(--color-success)' : 'var(--color-danger)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                }}
              >
                {validationData.valid ? '✓' : '✕'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--text-md)', color: validationData.valid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {validationData.valid ? 'CRYPTOGRAPHICALLY VERIFIED' : `STATUS: ${validationData.status}`}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                  {validationData.valid
                    ? 'Ed25519 digital signature authentic and runtime license is active.'
                    : validationData.error || 'License is not currently authorized for trade execution.'}
                </span>
              </div>
            </div>

            {/* Audit Details */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>License ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{license.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Workspace Target:</span>
                <span>{currentWorkspace?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>License Key:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>
                  {license.licenseKey.substring(0, 24)}...
                </span>
              </div>
              {validationData.expiresAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Valid Until:</span>
                  <span>{new Date(validationData.expiresAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
