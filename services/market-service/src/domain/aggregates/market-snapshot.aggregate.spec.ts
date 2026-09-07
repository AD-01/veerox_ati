import { MarketSnapshot } from './market-snapshot.aggregate';

describe('MarketSnapshot Aggregate', () => {
  const validProps = {
    symbolId: '00000000-0000-0000-0000-000000000000',
    timeframe: 'M1',
    timestamp: new Date('2026-08-12T10:00:00.000Z'),
    referencePrice: 1.5,
    trendDirection: 'UP',
    trendStrength: 75,
    volatility: 0.005,
    liquidityScore: 90,
    regime: 'Trending',
    confidenceScore: 85,
    marketHealthScore: 95,
  };

  it('should create a valid market snapshot', () => {
    const snapshot = MarketSnapshot.create(validProps);
    expect(snapshot.id).toBeDefined();
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.createdAt).toBeInstanceOf(Date);
    expect(snapshot.referencePrice).toBe(1.5);
    expect(snapshot.trendDirection).toBe('UP');
    expect(snapshot.trendStrength).toBe(75);
    expect(snapshot.volatility).toBe(0.005);
    expect(snapshot.liquidityScore).toBe(90);
    expect(snapshot.regime).toBe('Trending');
    expect(snapshot.confidenceScore).toBe(85);
    expect(snapshot.marketHealthScore).toBe(95);
  });

  it('should reconstruct from existing props', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const createdAt = new Date('2026-08-12T10:01:00.000Z');
    const snapshot = MarketSnapshot.reconstruct({
      ...validProps,
      id,
      snapshotVersion: 2,
      createdAt,
    });
    expect(snapshot.id).toBe(id);
    expect(snapshot.snapshotVersion).toBe(2);
    expect(snapshot.createdAt).toBe(createdAt);
  });

  describe('Validation Rules', () => {
    it('should reject invalid trend strength', () => {
      expect(() => MarketSnapshot.create({ ...validProps, trendStrength: -1 })).toThrow('Trend strength must be between 0 and 100');
      expect(() => MarketSnapshot.create({ ...validProps, trendStrength: 101 })).toThrow('Trend strength must be between 0 and 100');
    });

    it('should reject invalid liquidity score', () => {
      expect(() => MarketSnapshot.create({ ...validProps, liquidityScore: -5 })).toThrow('Liquidity score must be between 0 and 100');
      expect(() => MarketSnapshot.create({ ...validProps, liquidityScore: 105 })).toThrow('Liquidity score must be between 0 and 100');
    });

    it('should reject invalid confidence score', () => {
      expect(() => MarketSnapshot.create({ ...validProps, confidenceScore: -10 })).toThrow('Confidence score must be between 0 and 100');
      expect(() => MarketSnapshot.create({ ...validProps, confidenceScore: 110 })).toThrow('Confidence score must be between 0 and 100');
    });

    it('should reject invalid market health score', () => {
      expect(() => MarketSnapshot.create({ ...validProps, marketHealthScore: -1 })).toThrow('Market health score must be between 0 and 100');
      expect(() => MarketSnapshot.create({ ...validProps, marketHealthScore: 101 })).toThrow('Market health score must be between 0 and 100');
    });

    it('should reject negative volatility', () => {
      expect(() => MarketSnapshot.create({ ...validProps, volatility: -0.01 })).toThrow('Volatility cannot be negative');
    });

    it('should reject invalid regime', () => {
      expect(() => MarketSnapshot.create({ ...validProps, regime: 'InvalidRegime' })).toThrow('Invalid market regime: InvalidRegime');
    });

    it('should reject invalid trend direction', () => {
      expect(() => MarketSnapshot.create({ ...validProps, trendDirection: 'SIDEWAYS' })).toThrow('Invalid trend direction: SIDEWAYS');
    });
  });
});
