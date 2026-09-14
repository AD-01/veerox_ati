const nextConfig = require('./next.config.js');

describe('next.config.js Security Headers', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
  });

  it('contains strict Content-Security-Policy', async () => {
    (process.env as any).NODE_ENV = 'production';
    const headersConfig = await nextConfig.headers();
    const globalHeaders = headersConfig.find((h: any) => h.source === '/(.*)')?.headers;
    
    const csp = globalHeaders?.find((h: any) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('contains Strict-Transport-Security in production', async () => {
    (process.env as any).NODE_ENV = 'production';
    const headersConfig = await nextConfig.headers();
    const globalHeaders = headersConfig.find((h: any) => h.source === '/(.*)')?.headers;
    
    const hsts = globalHeaders?.find((h: any) => h.key === 'Strict-Transport-Security')?.value;
    expect(hsts).toBe('max-age=63072000; includeSubDomains');
  });

  it('omits Strict-Transport-Security in development', async () => {
    (process.env as any).NODE_ENV = 'development';
    const headersConfig = await nextConfig.headers();
    const globalHeaders = headersConfig.find((h: any) => h.source === '/(.*)')?.headers;
    
    const hsts = globalHeaders?.find((h: any) => h.key === 'Strict-Transport-Security');
    expect(hsts).toBeUndefined();
  });

  it('contains unsafe-eval in development CSP for Fast Refresh', async () => {
    (process.env as any).NODE_ENV = 'development';
    const headersConfig = await nextConfig.headers();
    const globalHeaders = headersConfig.find((h: any) => h.source === '/(.*)')?.headers;
    
    const csp = globalHeaders?.find((h: any) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("'unsafe-eval'");
  });
});
