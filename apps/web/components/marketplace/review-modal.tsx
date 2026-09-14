'use client';

import React, { useState } from 'react';
import { Modal, Button, Alert } from '@veerox/ui';
import { useAuth } from '../../lib/context/auth-context';
import { useWorkspace } from '../../lib/context/workspace-context';
import { useToast } from '../../lib/context/toast-context';

export interface ReviewModalProps {
  productId: string;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  productId,
  productName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !user?.id) {
      setError('You must be logged into an active workspace to submit a review.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/marketplace/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          userId: user.id,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to submit review');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      showToast({
        type: 'success',
        title: 'Review Submitted',
        message: 'Thank you for your rating and feedback!',
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while submitting review.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review "${productName}"`}
      maxWidth="480px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            Submit Review
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <Alert type="error" title="Submission Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Rating (1 - 5 Stars)
          </label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: star <= rating ? '#f59e0b' : 'var(--color-text-dim)',
                  transition: 'transform var(--transition-fast)',
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Feedback & Comments (Optional)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your experience regarding latency, drawdown, win-rate, or execution performance..."
            rows={4}
            style={{
              width: '100%',
              backgroundColor: 'var(--color-surface-input)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-muted)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
      </form>
    </Modal>
  );
};
