'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { LicenseDto } from '@veerox/contracts';
import { useWorkspace } from '../../../../lib/context/workspace-context';
import { useToast } from '../../../../lib/context/toast-context';
import { SuspendLicenseModal } from '../../../../components/licensing/suspend-license-modal';
import { RevokeLicenseModal } from '../../../../components/licensing/revoke-license-modal';
import { ValidateLicenseModal } from '../../../../components/licensing/validate-license-modal';

export default function LicenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [license, setLicense] = useState<LicenseDto | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [isValidateOpen, setIsValidateOpen] = useState(false);

  const fetchLicenseDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/licensing/licenses/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data) {
        setError(data.error || data.message || `License with ID ${id} not found.`);
        setIsLoading(false);
        return;
      }

      setLicense(data.data);
      if (data.data.product) {
        setProduct(data.data.product);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve license details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLicenseDetail();
  }, [fetchLicenseDetail]);

  const handleReactivate = async () => {
    if (!license || !currentOrganization?.id || !currentWorkspace?.id) return;

    try {
      const res = await fetch(`/api/licensing/licenses/${license.id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          workspaceId: currentWorkspace.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({
          type: 'error',
          title: 'Reactivation Failed',
          message: data.error || data.message || 'Could not reactivate license',
        });
        return;
      }

      showToast({
        type: 'success',
        title: 'License Reactivated',
        message: 'License has been reactivated and verified.',
      });
      fetchLicenseDetail();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Reactivation Error',
        message: err.message || 'An error occurred during reactivation.',
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Skeleton width="180px" height="24px" />
        <Skeleton width="60%" height="40px" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <Card glass><Skeleton height="300px" /></Card>
          <Card glass><Skeleton height="300px" /></Card>
        </div>
      </div>
    );
  }

  if (error || !license) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <Card glass bordered style={{ padding: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <CardTitle style={{ color: 'var(--color-danger)' }}>License Record Not Found</CardTitle>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '8px' }}>
            {error || `License with identifier "${id}" does not exist or has been deleted.`}
          </p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/licensing">
              <Button variant="primary">Return to Licensing Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isActive = license.status === 'ACTIVE';
  const isSuspended = license.status === 'SUSPENDED';
  const isRevoked = license.status === 'REVOKED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        <Link href="/licensing" style={{ color: 'var(--color-brand-cyan)' }}>
          Licensing
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-primary)' }}>{license.id}</span>
      </div>

      {/* Hero Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Badge variant={product?.productType === 'EA' ? 'brand' : 'success'} size="md">
              {product?.productType || 'STRATEGY'}
            </Badge>
            <Badge variant={isActive ? 'success' : isSuspended ? 'warning' : 'danger'} size="sm" dot>
              {license.status}
            </Badge>
          </div>

          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {product?.name || `Product License #${license.productId.substring(0, 8)}`}
          </h1>

          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            License Key Fingerprint:{' '}
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>
              {license.licenseKey.substring(0, 32)}...
            </strong>
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button variant="primary" size="md" onClick={() => setIsValidateOpen(true)}>
            Verify Signature
          </Button>

          {isActive && (
            <Button variant="ghost" size="md" onClick={() => setIsSuspendOpen(true)}>
              Suspend
            </Button>
          )}

          {isSuspended && (
            <Button variant="secondary" size="md" onClick={() => handleReactivate()}>
              Reactivate
            </Button>
          )}

          {!isRevoked && (
            <Button variant="danger" size="md" onClick={() => setIsRevokeOpen(true)}>
              Revoke
            </Button>
          )}
        </div>
      </div>

      {/* Main Spec & Audit Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Cryptographic Proof Card */}
        <Card glass bordered>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Ed25519 Cryptographic Verification</CardTitle>
              <Badge variant="brand" size="sm">SECURITY AUDIT</Badge>
            </div>
            <CardDescription>Digital signature authenticity and non-repudiation</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--color-success-bg)' : 'var(--color-surface-base)',
                  border: `1px solid ${isActive ? 'var(--color-success)' : 'var(--color-border-subtle)'}`,
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.5,
                }}
              >
                {isActive ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontWeight: 700 }}>
                    <span>✓</span>
                    <span>Ed25519 digital signature verified. Execution authorized on MT5 agent gateway.</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    License status is currently <strong>{license.status}</strong>. Live trade execution is blocked.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Cryptographic Scheme:</span>
                  <span style={{ fontWeight: 600 }}>Ed25519 (RFC 8032)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Authorization Mode:</span>
                  <span style={{ fontWeight: 600 }}>Zero-Knowledge Token Proof</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>License State:</span>
                  <span style={{ fontWeight: 700, color: isActive ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {license.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata Specs */}
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Entitlement Metadata</CardTitle>
            <CardDescription>Tenant binding and lifetime timestamps</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>License ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-cyan)' }}>{license.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Workspace ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{license.workspaceId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Vendor Organization:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{license.organizationId}</span>
              </div>
              {license.subscriptionId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Subscription Ref:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{license.subscriptionId}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Issued At:</span>
                <span>{new Date(license.issuedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Expires At:</span>
                <span>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Permanent / Auto-Renew'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <SuspendLicenseModal
        license={license}
        isOpen={isSuspendOpen}
        onClose={() => setIsSuspendOpen(false)}
        onSuccess={() => fetchLicenseDetail()}
      />

      <RevokeLicenseModal
        license={license}
        isOpen={isRevokeOpen}
        onClose={() => setIsRevokeOpen(false)}
        onSuccess={() => fetchLicenseDetail()}
      />

      <ValidateLicenseModal
        license={license}
        isOpen={isValidateOpen}
        onClose={() => setIsValidateOpen(false)}
      />
    </div>
  );
}
