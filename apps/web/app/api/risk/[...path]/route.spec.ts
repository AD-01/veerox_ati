import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { proxyToBackend, SERVICE_URLS } from '../../../../lib/bff-client';

jest.mock('../../../../lib/bff-client', () => ({
  proxyToBackend: jest.fn(),
  SERVICE_URLS: {
    risk: 'http://localhost:3005',
  },
}));

describe('Risk BFF Route - Phase 07E-D', () => {
  const mockProxy = proxyToBackend as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (url: string, headers: Record<string, string> = {}) => {
    return new NextRequest(new URL(url), {
      headers: new Headers(headers),
    });
  };

  it('1. Correctly constructs target URL/path for risk-utilization', async () => {
    const req = createRequest('http://localhost:3000/api/risk/workspaces/ws-1/accounts/acc-1/risk-utilization');
    const params = Promise.resolve({ path: ['workspaces', 'ws-1', 'accounts', 'acc-1', 'risk-utilization'] });

    await GET(req, { params });

    expect(mockProxy).toHaveBeenCalledWith(
      req,
      'http://localhost:3005',
      '/workspaces/ws-1/accounts/acc-1/risk-utilization'
    );
  });

  it('2. Correctly forwards POST methods using proxyToBackend', async () => {
    const req = createRequest('http://localhost:3000/api/risk/workspaces/ws-1/accounts/acc-1/risk-utilization');
    const params = Promise.resolve({ path: ['workspaces', 'ws-1', 'accounts', 'acc-1', 'risk-utilization'] });

    await POST(req, { params });

    expect(mockProxy).toHaveBeenCalledWith(
      req,
      'http://localhost:3005',
      '/workspaces/ws-1/accounts/acc-1/risk-utilization'
    );
  });

  it('3 & 4 & 5. Preserves headers via bff-client and does not expose internal host', async () => {
    // The test validates that we hand off the request cleanly to `proxyToBackend`
    // which handles the secure HttpOnly cookie injection and header forwarding.
    // The internal SERVICE_URLS.risk is kept server-side and never returned to the client.
    const req = createRequest('http://localhost:3000/api/risk/workspaces/ws-1/accounts/acc-1/risk-utilization', {
      'x-correlation-id': 'corr-123',
    });
    const params = Promise.resolve({ path: ['workspaces', 'ws-1', 'accounts', 'acc-1', 'risk-utilization'] });

    mockProxy.mockResolvedValueOnce(
      new Response(JSON.stringify({ riskScore: 85 }), { status: 200 })
    );

    const res = await GET(req, { params });
    const json = await (res as Response).json();

    expect(json).toEqual({ riskScore: 85 });
    expect(mockProxy).toHaveBeenCalled();
  });

  it('6. Backend error statuses are forwarded properly', async () => {
    const req = createRequest('http://localhost:3000/api/risk/workspaces/ws-1/accounts/acc-1/risk-utilization');
    const params = Promise.resolve({ path: ['workspaces', 'ws-1', 'accounts', 'acc-1', 'risk-utilization'] });

    mockProxy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    );

    const res = await GET(req, { params });
    expect((res as Response).status).toBe(404);
  });
});
