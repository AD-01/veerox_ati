'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert, Skeleton } from '@veerox/ui';
import { MarketplaceProductDto, ProductReviewDto } from '@veerox/contracts';
import { PurchaseModal } from '../../../../components/marketplace/purchase-modal';
import { ReviewModal } from '../../../../components/marketplace/review-modal';

export default function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<MarketplaceProductDto | null>(null);
  const [reviews, setReviews] = useState<ProductReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const fetchProductDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/marketplace/products/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data) {
        setError(data.error || data.message || `Product with ID ${id} could not be located.`);
        setIsLoading(false);
        return;
      }

      setProduct(data.data);
      // If reviews are included in product or accessible
      if (data.data.reviews && Array.isArray(data.data.reviews)) {
        setReviews(data.data.reviews);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProductDetail();
  }, [fetchProductDetail]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Skeleton width="160px" height="24px" />
        <Skeleton width="60%" height="40px" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <Card glass><Skeleton height="300px" /></Card>
          <Card glass><Skeleton height="300px" /></Card>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <Card glass bordered style={{ padding: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <CardTitle style={{ color: 'var(--color-danger)' }}>Product Not Found</CardTitle>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '8px' }}>
            {error || `Product with identifier "${id}" does not exist or has been archived.`}
          </p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link href="/marketplace">
              <Button variant="primary">Return to Marketplace</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const features = Array.isArray(product.features)
    ? product.features
    : typeof product.features === 'string'
    ? JSON.parse(product.features)
    : [];

  const requirements = typeof product.requirements === 'string'
    ? JSON.parse(product.requirements)
    : product.requirements;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        <Link href="/marketplace" style={{ color: 'var(--color-brand-cyan)' }}>
          Marketplace
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-primary)' }}>{product.name}</span>
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
            <Badge variant="brand" size="md">
              {product.productType}
            </Badge>
            {product.version && (
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                v{product.version}
              </span>
            )}
            <Badge variant="success" size="sm" dot>
              {product.status}
            </Badge>
          </div>

          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {product.name}
          </h1>

          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', lineHeight: 1.5, maxWidth: '800px' }}>
            {product.description || 'Professional automated quantitative trading algorithm.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '8px', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
              <span>★</span>
              <span style={{ color: 'var(--color-text-primary)' }}>{Number(product.averageRating || 0).toFixed(1)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({product.reviewCount || 0} reviews)</span>
            </div>

            <div style={{ color: 'var(--color-text-muted)' }}>
              <span style={{ color: 'var(--color-brand-cyan)', fontWeight: 600 }}>{product.purchaseCount || 0}</span> Active Deployments
            </div>
          </div>
        </div>

        {/* Pricing & Deployment Card Action */}
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: '240px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Commercial Price</span>
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(product.price).toFixed(2)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {product.currency} / {product.pricingModel.toLowerCase()}
            </span>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => setIsPurchaseOpen(true)}
            style={{ width: '100%' }}
          >
            Deploy & License
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReviewOpen(true)}
            style={{ width: '100%' }}
          >
            Write Review
          </Button>
        </div>
      </div>

      {/* Main Specs & Technical Information */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Features & Algorithm Capabilities */}
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Algorithm Features & Edge</CardTitle>
            <CardDescription>Execution mechanics and built-in risk limiters</CardDescription>
          </CardHeader>
          <CardContent>
            {features && features.length > 0 ? (
              <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {features.map((feature: string, idx: number) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Multi-timeframe momentum analysis, automated trailing stop-loss, and dynamic position sizing.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Technical Requirements & Metadata */}
        <Card glass bordered>
          <CardHeader>
            <CardTitle>Technical Requirements & Metadata</CardTitle>
            <CardDescription>Runtime specifications and broker execution environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Product ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-brand-cyan)' }}>{product.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Vendor Org ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{product.organizationId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Pricing Model:</span>
                <span style={{ fontWeight: 600 }}>{product.pricingModel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Created At:</span>
                <span>{new Date(product.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Community Reviews Section */}
      <Card glass bordered>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle>Trader Reviews & Ratings</CardTitle>
              <CardDescription>Verified reviews from active workspace operators</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsReviewOpen(true)}>
              Write Review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reviews.map(review => (
                <div
                  key={review.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-base)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#f59e0b', fontSize: '14px' }}>
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '24px 0' }}>
              No reviews submitted yet. Be the first to review this product after deploying it!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Purchase Modal */}
      <PurchaseModal
        product={product}
        isOpen={isPurchaseOpen}
        onClose={() => setIsPurchaseOpen(false)}
        onSuccess={() => fetchProductDetail()}
      />

      {/* Review Modal */}
      <ReviewModal
        productId={product.id}
        productName={product.name}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSuccess={() => fetchProductDetail()}
      />
    </div>
  );
}
