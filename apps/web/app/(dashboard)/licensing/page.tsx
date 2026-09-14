'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { LicenseDto } from '@veerox/contracts';
import { useWorkspace } from '../../../lib/context/workspace-context';
import { useToast } from '../../../lib/context/toast-context';
import { SuspendLicenseModal } from '../../../components/licensing/suspend-license-modal';
import { RevokeLicenseModal } from '../../../components/licensing/revoke-license-modal';
import { ValidateLicenseModal } from '../../../components/licensing/validate-license-modal';

export default function LicensingPage() {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [licenses, setLicenses] = useState<LicenseDto[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedLicenseForSuspend, setSelectedLicenseForSuspend] = useState<LicenseDto | null>(null);
  const [selectedLicenseForRevoke, setSelectedLicenseForRevoke] = useState<LicenseDto | null>(null);
  const [selectedLicenseForValidate, setSelectedLicenseForValidate] = useState<LicenseDto | null>(null);

  const fetchLicenses = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const orgQuery = currentOrganization?.id ? `?organizationId=${currentOrganization.id}` : '';
      const res = await fetch(`/api/licensing/workspaces/${currentWorkspace.id}/licenses${orgQuery}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to load licenses for workspace');
        setIsLoading(false);
        return;
      }

      setLicenses(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Network error while fetching licenses');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, currentOrganization?.id]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleReactivate = async (license: LicenseDto) => {
    if (!currentOrganization?.id || !currentWorkspace?.id) return;

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
        message: `License #${license.id.substring(0, 8)} is now active and verified.`,
      });
      fetchLicenses();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Reactivation Error',
        message: err.message || 'An error occurred during reactivation.',
      });
    }
  };

  const activeCount = licenses.filter(l => l.status === 'ACTIVE').length;
  const suspendedCount = licenses.filter(l => l.status === 'SUSPENDED').length;
  const revokedCount = licenses.filter(l => l.status === 'REVOKED').length;
  const expiredCount = licenses.filter(l => l.status === 'EXPIRED').length;

  const filteredLicenses = licenses.filter(l => {
    if (selectedStatus === 'ALL') return true;
    return l.status === selectedStatus;
  });

  const statusFilters = [
    { label: 'All Licenses', value: 'ALL', count: licenses.length },
    { label: 'Active', value: 'ACTIVE', count: activeCount },
    { label: 'Suspended', value: 'SUSPENDED', count: suspendedCount },
    { label: 'Revoked', value: 'REVOKED', count: revokedCount },
    { label: 'Expired', value: 'EXPIRED', count: expiredCount },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              License Management
            </h1>
            <Badge variant="brand" size="sm">
              S-24 PHASE 05
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Cryptographic Ed25519 digital signatures, runtime execution entitlements, and lifecycle controls for{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{currentWorkspace?.name || 'Active Workspace'}</strong>.
          </p>
        </div>

        <Button variant="secondary" size="md" onClick={() => fetchLicenses()} isLoading={isLoading}>
          ↻ Refresh Licenses
        </Button>
      </div>

      {/* KPI Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Active & Verified
              </span>
              <Badge variant="success" size="sm" dot>ED25519</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: 'var(--color-success)' }}>
              {activeCount}
            </CardTitle>
            <CardDescription>Authorized for MT5 live execution</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Suspended
              </span>
              <Badge variant="warning" size="sm">PAUSED</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: suspendedCount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
              {suspendedCount}
            </CardTitle>
            <CardDescription>Temporarily halted execution</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Revoked
              </span>
              <Badge variant="danger" size="sm">TERMINATED</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: revokedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {revokedCount}
            </CardTitle>
            <CardDescription>Permanently invalidated</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Total Entitlements
              </span>
              <Badge variant="brand" size="sm">TOTAL</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {licenses.length}
            </CardTitle>
            <CardDescription>Registered workspace licenses</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <Alert type="error" title="Licensing Query Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Status Filter Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {statusFilters.map(filter => {
          const isSelected = selectedStatus === filter.value;
          return (
            <button
              key={filter.value}
              onClick={() => setSelectedStatus(filter.value)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--color-brand-cyan)' : '1px solid var(--color-border-subtle)',
                backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--color-surface-card)',
                color: isSelected ? 'var(--color-brand-cyan)' : 'var(--color-text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {filter.label} ({filter.count})
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => (
            <Card key={n} glass><Skeleton height="140px" /></Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredLicenses.length === 0 && (
        <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔑</div>
          <CardTitle>No Licenses Found</CardTitle>
          <CardDescription style={{ maxWidth: '460px', margin: '8px auto 20px auto' }}>
            {selectedStatus !== 'ALL'
              ? `No licenses found matching status "${selectedStatus}".`
              : 'This workspace does not currently hold any strategy execution licenses. Purchase a strategy from the Marketplace to activate licenses.'}
          </CardDescription>
          {selectedStatus === 'ALL' && (
            <Link href="/marketplace">
              <Button variant="primary" size="sm">
                Explore Marketplace
              </Button>
            </Link>
          )}
        </Card>
      )}

      {/* Licenses Grid / List */}
      {!isLoading && filteredLicenses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLicenses.map(license => {
            const product = (license as any).product;
            const isSuspended = license.status === 'SUSPENDED';
            const isRevoked = license.status === 'REVOKED';
            const isActive = license.status === 'ACTIVE';

            return (
              <Card
                key={license.id}
                glass
                bordered
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge variant={product?.productType === 'EA' ? 'brand' : 'success'} size="sm">
                      {product?.productType || 'STRATEGY'}
                    </Badge>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>
                      {product?.name || `Product #${license.productId.substring(0, 8)}`}
                    </span>
                    <Badge
                      variant={isActive ? 'success' : isSuspended ? 'warning' : 'danger'}
                      size="sm"
                      dot
                    >
                      {license.status}
                    </Badge>
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <span>
                      License ID: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>{license.id.substring(0, 13)}</strong>
                    </span>
                    <span>
                      Issued: <strong>{new Date(license.issuedAt).toLocaleDateString()}</strong>
                    </span>
                    {license.expiresAt && (
                      <span>
                        Expires: <strong>{new Date(license.expiresAt).toLocaleDateString()}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Suite */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedLicenseForValidate(license)}
                  >
                    Verify Signature
                  </Button>

                  <Link href={`/licensing/${license.id}`}>
                    <Button variant="outline" size="sm">
                      Inspect
                    </Button>
                  </Link>

                  {isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLicenseForSuspend(license)}
                    >
                      Suspend
                    </Button>
                  )}

                  {isSuspended && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleReactivate(license)}
                    >
                      Reactivate
                    </Button>
                  )}

                  {!isRevoked && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setSelectedLicenseForRevoke(license)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <SuspendLicenseModal
        license={selectedLicenseForSuspend}
        isOpen={!!selectedLicenseForSuspend}
        onClose={() => setSelectedLicenseForSuspend(null)}
        onSuccess={() => fetchLicenses()}
      />

      <RevokeLicenseModal
        license={selectedLicenseForRevoke}
        isOpen={!!selectedLicenseForRevoke}
        onClose={() => setSelectedLicenseForRevoke(null)}
        onSuccess={() => fetchLicenses()}
      />

      <ValidateLicenseModal
        license={selectedLicenseForValidate}
        isOpen={!!selectedLicenseForValidate}
        onClose={() => setSelectedLicenseForValidate(null)}
      />
    </div>
  );
}
