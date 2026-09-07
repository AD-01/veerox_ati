import { IntelligenceEngineService } from './intelligence-engine.service';

describe('IntelligenceEngineService', () => {
  let service: IntelligenceEngineService;

  beforeEach(() => {
    service = new IntelligenceEngineService();
  });

  it('should generate an UP trend snapshot for a bullish candle', () => {
    const snapshot = service.generateSnapshot({
      symbolId: '00000000-0000-0000-0000-000000000000',
      timeframe: 'H1',
      timestamp: new Date(),
      open: 1.1000,
      high: 1.1050,
      low: 1.0990,
      close: 1.1045,
      volume: 1500,
    });

    expect(snapshot.trendDirection).toBe('UP');
    expect(snapshot.trendStrength).toBeGreaterThan(70);
    expect(snapshot.liquidityScore).toBe(100);
    expect(snapshot.regime).toBe('Trending');
    expect(snapshot.confidenceScore).toBe(90);
    expect(snapshot.volatility).toBeCloseTo((1.1050 - 1.0990) / 1.1000);
    expect(snapshot.referencePrice).toBe(1.1045);
  });

  it('should generate a DOWN trend snapshot for a bearish candle', () => {
    const snapshot = service.generateSnapshot({
      symbolId: '00000000-0000-0000-0000-000000000000',
      timeframe: 'H1',
      timestamp: new Date(),
      open: 1.1000,
      high: 1.1010,
      low: 1.0950,
      close: 1.0960,
      volume: 500,
    });

    expect(snapshot.trendDirection).toBe('DOWN');
    // Body is 0.0040, total is 0.0060 -> strength is 67
    expect(snapshot.trendStrength).toBe(67);
    expect(snapshot.liquidityScore).toBe(50);
    expect(snapshot.regime).toBe('Uncertain'); // 67 is neither >70 nor <30, and volatility is < 0.01
    expect(snapshot.referencePrice).toBe(1.0960);
  });

  it('should reduce confidence for zero volume', () => {
    const snapshot = service.generateSnapshot({
      symbolId: '00000000-0000-0000-0000-000000000000',
      timeframe: 'H1',
      timestamp: new Date(),
      open: 1.1000,
      high: 1.1010,
      low: 1.0990,
      close: 1.1000, // Flat
      volume: 0,
    });

    expect(snapshot.trendDirection).toBe('FLAT');
    expect(snapshot.confidenceScore).toBeLessThan(90);
    expect(snapshot.liquidityScore).toBe(10); // Minimum 10
  });

  it('should identify high volatility regime', () => {
    const snapshot = service.generateSnapshot({
      symbolId: '00000000-0000-0000-0000-000000000000',
      timeframe: 'H1',
      timestamp: new Date(),
      open: 1.0000,
      high: 1.0500, // 5% up
      low: 0.9900,
      close: 1.0200,
      volume: 1000,
    });

    expect(snapshot.volatility).toBeCloseTo(0.06); // 0.06 / 1.0000
    // Body 0.0200, total 0.0600 -> 33 strength (not > 70 and not < 30)
    // Volatility > 0.01, so High Volatility
    expect(snapshot.regime).toBe('High Volatility');
    // Confidence drops by 20 because of extreme volatility (> 0.05)
    expect(snapshot.confidenceScore).toBe(70);
  });
});
