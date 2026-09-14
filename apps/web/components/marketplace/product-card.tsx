'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@veerox/ui';
import { MarketplaceProductDto } from '@veerox/contracts';

export interface ProductCardProps {
  product: MarketplaceProductDto;
  onPurchaseClick: (product: MarketplaceProductDto) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPurchaseClick }) => {
  const typeColors = {
    EA: 'brand',
    STRATEGY: 'success',
    AI_MODEL: 'info',
  } as const;

  const badgeVariant = (typeColors[product.productType as keyof typeof typeColors] || 'neutral') as any;

  return (
    <Card glass bordered hoverable style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <Badge variant={badgeVariant} size="sm">
            {product.productType}
          </Badge>
          {product.version && (
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              v{product.version}
            </span>
          )}
        </div>

        <CardTitle style={{ fontSize: 'var(--text-lg)' }}>{product.name}</CardTitle>
        <CardDescription style={{ minHeight: '40px' }}>
          {product.description || 'High-performance automated quantitative trading strategy.'}
        </CardDescription>
      </CardHeader>

      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
        {/* Rating & Purchase Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 600 }}>
            <span>★</span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {Number(product.averageRating || 0).toFixed(1)}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>({product.reviewCount || 0})</span>
          </div>

          <div style={{ color: 'var(--color-text-muted)' }}>
            <span style={{ color: 'var(--color-brand-cyan)', fontWeight: 600 }}>{product.purchaseCount || 0}</span> active deploys
          </div>
        </div>

        {/* Price display */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-base)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>License Price</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              ${Number(product.price).toFixed(2)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
              {product.currency} / {product.pricingModel.toLowerCase()}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter style={{ marginTop: '16px', paddingTop: '12px', display: 'flex', gap: '10px' }}>
        <Link href={`/marketplace/${product.id}`} style={{ flex: 1 }}>
          <Button variant="outline" size="sm" style={{ width: '100%' }}>
            Inspect & Details
          </Button>
        </Link>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onPurchaseClick(product)}
          style={{ flex: 1 }}
        >
          Deploy
        </Button>
      </CardFooter>
    </Card>
  );
};
