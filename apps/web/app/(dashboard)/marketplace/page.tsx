'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Card, Badge, Alert, Skeleton } from '@veerox/ui';
import { MarketplaceProductDto } from '@veerox/contracts';
import { ProductCard } from '../../../components/marketplace/product-card';
import { PurchaseModal } from '../../../components/marketplace/purchase-modal';

export default function MarketplacePage() {
  const [products, setProducts] = useState<MarketplaceProductDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [minRating, setMinRating] = useState<string>('0');

  // Purchase Modal State
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProductDto | null>(null);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState<boolean>(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('searchTerm', searchTerm.trim());
      if (selectedType !== 'ALL') params.set('productType', selectedType);
      if (parseFloat(minRating) > 0) params.set('minRating', minRating);
      params.set('take', '24');

      const res = await fetch(`/api/marketplace/products?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to retrieve products from marketplace');
        setIsLoading(false);
        return;
      }

      setProducts(data.data || []);
      setTotalCount(data.total || (data.data ? data.data.length : 0));
    } catch (err: any) {
      setError(err.message || 'Network error while contacting marketplace');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedType, minRating]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250); // 250ms debounce
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handlePurchaseClick = (product: MarketplaceProductDto) => {
    setSelectedProduct(product);
    setIsPurchaseOpen(true);
  };

  const productTypes = [
    { label: 'All Products', value: 'ALL' },
    { label: 'Expert Advisors (EA)', value: 'EA' },
    { label: 'Trading Strategies', value: 'STRATEGY' },
    { label: 'AI & Neural Models', value: 'AI_MODEL' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--color-text-primary)',
              }}
            >
              Strategy & Model Marketplace
            </h1>
            <Badge variant="brand" size="sm">
              S-24 PHASE 03
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: '4px' }}>
            Discover, license, and instantly deploy verified quantitative algorithms, EAs, and machine learning models.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Catalog Count:</span>
          <Badge variant="neutral" size="md">
            {totalCount} Verified Assets
          </Badge>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Input
              placeholder="Search strategies by name, currency pair, or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<span style={{ fontSize: '14px' }}>🔍</span>}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={minRating}
              onChange={e => setMinRating(e.target.value)}
              style={{
                height: '42px',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-muted)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="0">All Ratings (0+ ★)</option>
              <option value="4.0">Top Rated (4.0+ ★)</option>
              <option value="4.5">Elite (4.5+ ★)</option>
            </select>
          </div>
        </div>

        {/* Product Type Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {productTypes.map(type => {
            const isSelected = selectedType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                style={{
                  padding: '6px 14px',
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
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert type="error" title="Marketplace Query Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Card key={n} glass bordered style={{ height: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width="80px" height="24px" />
                <Skeleton width="40px" height="16px" />
              </div>
              <Skeleton width="60%" height="24px" />
              <Skeleton width="100%" height="48px" />
              <Skeleton height="36px" style={{ marginTop: 'auto' }} />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State / Search No-Results */}
      {!isLoading && products.length === 0 && (
        <Card glass bordered style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛒</div>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            No Matching Trading Strategies Found
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '6px', maxWidth: '500px', margin: '6px auto 20px auto' }}>
            {searchTerm || selectedType !== 'ALL' || minRating !== '0'
              ? 'No products matched your active filters. Try resetting search parameters or selecting another category.'
              : 'The commercial marketplace catalog is currently empty. New quantitative strategies and models will appear here once published.'}
          </p>
          {(searchTerm || selectedType !== 'ALL' || minRating !== '0') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedType('ALL');
                setMinRating('0');
              }}
            >
              Reset All Filters
            </Button>
          )}
        </Card>
      )}

      {/* Product Grid */}
      {!isLoading && products.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onPurchaseClick={handlePurchaseClick}
            />
          ))}
        </div>
      )}

      {/* Purchase Modal */}
      <PurchaseModal
        product={selectedProduct}
        isOpen={isPurchaseOpen}
        onClose={() => {
          setIsPurchaseOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
        }}
      />
    </div>
  );
}
