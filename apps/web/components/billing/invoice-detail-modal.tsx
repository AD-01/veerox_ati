'use client';

import React from 'react';
import { Modal, Button, Badge } from '@veerox/ui';
import { InvoiceDto } from '@veerox/contracts';

export interface InvoiceDetailModalProps {
  invoice: InvoiceDto | null;
  isOpen: boolean;
  onClose: () => void;
  onPayClick?: (invoice: InvoiceDto) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onPayClick,
}) => {
  if (!invoice) return null;

  const isPaid = invoice.status === 'PAID';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invoice #${invoice.id.substring(0, 13)}`}
      maxWidth="540px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!isPaid && onPayClick && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onPayClick(invoice);
              }}
            >
              Pay Now (${Number(invoice.amount).toFixed(2)})
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Header Metadata */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Status</span>
            <div style={{ marginTop: '4px' }}>
              <Badge variant={isPaid ? 'success' : 'warning'} size="sm" dot>
                {invoice.status}
              </Badge>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Total Amount</span>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(invoice.amount).toFixed(2)} {invoice.currency}
            </div>
          </div>
        </div>

        {/* Date Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
          <div>
            <strong>Issued:</strong> {new Date(invoice.issuedAt).toLocaleDateString()}
          </div>
          {invoice.paidAt && (
            <div>
              <strong>Paid:</strong> {new Date(invoice.paidAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Line Items Breakdown
          </span>

          <div
            style={{
              marginTop: '8px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {invoice.lines && invoice.lines.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {invoice.lines.map((line, idx) => (
                  <div
                    key={line.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: idx % 2 === 0 ? 'var(--color-surface-panel)' : 'var(--color-surface-base)',
                      borderBottom: idx < invoice.lines!.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-primary)' }}>{line.description}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      ${Number(line.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Standard commercial subscription fee
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
