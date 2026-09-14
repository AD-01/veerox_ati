'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { SubscriptionDto, InvoiceDto, UsageRecordDto, BillingLedgerSummaryDto } from '@veerox/contracts';
import { useWorkspace } from '../../../lib/context/workspace-context';
import { CancelSubscriptionModal } from '../../../components/billing/cancel-subscription-modal';
import { PayInvoiceModal } from '../../../components/billing/pay-invoice-modal';
import { InvoiceDetailModal } from '../../../components/billing/invoice-detail-modal';

type BillingTab = 'subscriptions' | 'invoices' | 'usage' | 'ledger';

export default function BillingPage() {
  const { currentOrganization, currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<BillingTab>('subscriptions');

  // Data states
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecordDto[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<BillingLedgerSummaryDto | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<SubscriptionDto | null>(null);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<InvoiceDto | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceDto | null>(null);

  const fetchBillingData = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const orgQuery = currentOrganization?.id ? `?organizationId=${currentOrganization.id}` : '';

      const [subsRes, invsRes, usageRes, ledgerRes] = await Promise.all([
        fetch(`/api/billing/workspaces/${currentWorkspace.id}/subscriptions${orgQuery}`).catch(() => null),
        fetch(`/api/billing/workspaces/${currentWorkspace.id}/invoices${orgQuery}`).catch(() => null),
        fetch(`/api/billing/workspaces/${currentWorkspace.id}/usage`).catch(() => null),
        fetch(`/api/billing/workspaces/${currentWorkspace.id}/ledger`).catch(() => null),
      ]);

      if (subsRes && subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData.data || []);
      }

      if (invsRes && invsRes.ok) {
        const invsData = await invsRes.json();
        setInvoices(invsData.data || []);
      }

      if (usageRes && usageRes.ok) {
        const usageData = await usageRes.json();
        setUsageRecords(usageData.data || []);
      }

      if (ledgerRes && ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        if (ledgerData.data) {
          setLedgerEntries(ledgerData.data.entries || []);
          setLedgerSummary(ledgerData.data.summary || null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve workspace billing details.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, currentOrganization?.id]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const activeSubCount = subscriptions.filter(s => s.status === 'ACTIVE').length;
  const pendingInvoices = invoices.filter(i => i.status !== 'PAID');
  const totalBalance = ledgerSummary?.balance ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              Subscriptions & Billing
            </h1>
            <Badge variant="brand" size="sm">
              S-24 PHASE 04
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Financial accounting ledger, recurring subscriptions, invoices, and automated usage metering for{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{currentWorkspace?.name || 'Active Workspace'}</strong>.
          </p>
        </div>

        <Button variant="secondary" size="md" onClick={() => fetchBillingData()} isLoading={isLoading}>
          ↻ Refresh Ledger
        </Button>
      </div>

      {/* Financial KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Active Subscriptions
              </span>
              <Badge variant="success" size="sm" dot>LIVE</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {activeSubCount}
            </CardTitle>
            <CardDescription>{subscriptions.length} total registered</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Outstanding Invoices
              </span>
              <Badge variant={pendingInvoices.length > 0 ? 'warning' : 'neutral'} size="sm">
                {pendingInvoices.length} PENDING
              </Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {pendingInvoices.length}
            </CardTitle>
            <CardDescription>{invoices.length} total generated</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Net Ledger Balance
              </span>
              <Badge variant="info" size="sm">DOUBLE-ENTRY</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px', color: totalBalance > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
              ${Number(totalBalance).toFixed(2)}
            </CardTitle>
            <CardDescription>Workspace account balance</CardDescription>
          </CardHeader>
        </Card>

        <Card glass hoverable>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Usage Records
              </span>
              <Badge variant="brand" size="sm">METERED</Badge>
            </div>
            <CardTitle style={{ fontSize: 'var(--text-3xl)', marginTop: '8px' }}>
              {usageRecords.length}
            </CardTitle>
            <CardDescription>Logged execution metrics</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <Alert type="error" title="Billing Sync Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '12px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})` },
          { id: 'invoices', label: `Invoices (${invoices.length})` },
          { id: 'usage', label: `Usage Metering (${usageRecords.length})` },
          { id: 'ledger', label: `Accounting Ledger (${ledgerEntries.length})` },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BillingTab)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-surface-panel)' : 'transparent',
                color: isActive ? 'var(--color-brand-cyan)' : 'var(--color-text-secondary)',
                border: isActive ? '1px solid var(--color-border-muted)' : '1px solid transparent',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && (
            <Card glass><Skeleton height="150px" /></Card>
          )}

          {!isLoading && subscriptions.length === 0 && (
            <Card glass bordered style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💳</div>
              <CardTitle>No Active Subscriptions</CardTitle>
              <CardDescription style={{ maxWidth: '440px', margin: '8px auto 0 auto' }}>
                Your workspace does not hold any recurring strategy subscriptions. Explore the marketplace to license algorithms.
              </CardDescription>
            </Card>
          )}

          {!isLoading && subscriptions.map(sub => (
            <Card key={sub.id} glass bordered style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                    Subscription #{sub.id.substring(0, 13)}
                  </span>
                  <Badge variant={sub.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>
                    {sub.status}
                  </Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Product ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>{sub.productId}</span>
                  {' '}• Billing: <strong>{sub.billingPeriod}</strong>
                  {sub.nextBillingDate && ` • Next renewal: ${new Date(sub.nextBillingDate).toLocaleDateString()}`}
                </div>
              </div>

              <div>
                {sub.status === 'ACTIVE' && (
                  <Button variant="danger" size="sm" onClick={() => setSelectedSubForCancel(sub)}>
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && (
            <Card glass><Skeleton height="150px" /></Card>
          )}

          {!isLoading && invoices.length === 0 && (
            <Card glass bordered style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📄</div>
              <CardTitle>No Invoices Issued</CardTitle>
              <CardDescription>No billing statements have been generated for this workspace.</CardDescription>
            </Card>
          )}

          {!isLoading && invoices.map(inv => (
            <Card key={inv.id} glass bordered style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                    Invoice #{inv.id.substring(0, 13)}
                  </span>
                  <Badge variant={inv.status === 'PAID' ? 'success' : 'warning'} size="sm" dot>
                    {inv.status}
                  </Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Issued: {new Date(inv.issuedAt).toLocaleDateString()}
                  {inv.paidAt && ` • Paid: ${new Date(inv.paidAt).toLocaleDateString()}`}
                  {inv.lines && ` • (${inv.lines.length} line items)`}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    ${Number(inv.amount).toFixed(2)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>{inv.currency}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceDetail(inv)}>
                    View Lines
                  </Button>
                  {inv.status !== 'PAID' && (
                    <Button variant="primary" size="sm" onClick={() => setSelectedInvoiceForPay(inv)}>
                      Pay Now
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT 3: USAGE METERING */}
      {activeTab === 'usage' && (
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Workspace Usage Meter</CardTitle>
            <CardDescription>Execution telemetry, signals, and API call logs</CardDescription>
          </CardHeader>
          <CardContent>
            {usageRecords.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '24px 0' }}>
                No metered usage events recorded for this workspace.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {usageRecords.map(rec => (
                  <div
                    key={rec.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-panel)',
                      border: '1px solid var(--color-border-subtle)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {rec.metricName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(rec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant="brand" size="md">
                      {Number(rec.quantity).toLocaleString()} Units
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 4: ACCOUNTING LEDGER */}
      {activeTab === 'ledger' && (
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Double-Entry Transaction Ledger</CardTitle>
            <CardDescription>Complete immutable financial ledger for compliance and auditing</CardDescription>
          </CardHeader>
          <CardContent>
            {ledgerEntries.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '24px 0' }}>
                No financial ledger entries recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ledgerEntries.map(entry => {
                  const typeColors: Record<string, 'warning' | 'success' | 'info' | 'brand'> = {
                    CHARGE: 'warning',
                    PAYMENT: 'success',
                    REFUND: 'info',
                    CREDIT: 'brand',
                  };
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-surface-panel)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Badge variant={typeColors[entry.transactionType] || 'neutral'} size="sm">
                          {entry.transactionType}
                        </Badge>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {entry.description || 'Transaction entry'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                        ${Number(entry.amount).toFixed(2)} {entry.currency || 'USD'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        subscription={selectedSubForCancel}
        isOpen={!!selectedSubForCancel}
        onClose={() => setSelectedSubForCancel(null)}
        onSuccess={() => fetchBillingData()}
      />

      {/* Pay Invoice Modal */}
      <PayInvoiceModal
        invoice={selectedInvoiceForPay}
        isOpen={!!selectedInvoiceForPay}
        onClose={() => setSelectedInvoiceForPay(null)}
        onSuccess={() => fetchBillingData()}
      />

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoiceDetail}
        isOpen={!!selectedInvoiceDetail}
        onClose={() => setSelectedInvoiceDetail(null)}
        onPayClick={inv => setSelectedInvoiceForPay(inv)}
      />
    </div>
  );
}
