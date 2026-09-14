import { proxyToBackend, normalizeBffErrorResponse } from './bff-client';
import { NextRequest } from 'next/server';

jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn().mockReturnValue({ value: 'mocked_token' }),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

describe('normalizeBffErrorResponse', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (<any>process.env).NODE_ENV = 'production';
  });

  afterEach(() => {
    (<any>process.env).NODE_ENV = originalEnv;
  });

  it('TEST 20: BFF receives malformed backend JSON -> safe response', () => {
    // Simulated by passing empty object which represents failed parse
    const response = normalizeBffErrorResponse({}, 400);
    expect(response).toEqual({
      success: false,
      code: 'HTTP_ERROR',
      message: 'An error occurred',
    });
  });

  it('TEST 21: BFF receives arbitrary nested error object -> nested fields never leak', () => {
    const data = {
      success: false,
      code: 'ERROR',
      message: 'Safe error',
      cause: { message: 'database connection failed' },
      details: { stack: '...' }
    };
    // Safe error message isn't in allowlist unless we make it exact
    data.message = 'Forbidden';
    const response = normalizeBffErrorResponse(data, 403);
    
    expect(response).toEqual({
      success: false,
      code: 'ERROR',
      message: 'Forbidden',
    });
    // Ensure cause and details are stripped
    expect(response).not.toHaveProperty('cause');
    expect(response).not.toHaveProperty('details');
  });
});

describe('proxyToBackend', () => {
  let mockRequest: any;
  let cryptoSpy: jest.SpyInstance;
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockRequest = {
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
      headers: new Headers({
        'x-correlation-id': 'test-correlation-id',
      }),
      method: 'GET',
    } as unknown as NextRequest;
    (<any>process.env).NODE_ENV = 'production';
    cryptoSpy = jest.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid-1234');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (<any>process.env).NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('BFF receives backend 500 containing an internal-looking error -> browser receives sanitized response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      json: jest.fn().mockResolvedValue({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'PrismaClientKnownRequestError: connection refused',
      }),
    });

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      correlationId: 'mock-uuid-1234',
    });
    expect(response.headers.get('x-correlation-id')).toBe('mock-uuid-1234');
  });

  it('BFF receives safe backend 4xx -> existing client behavior remains compatible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: jest.fn().mockResolvedValue({
        success: false,
        code: 'HTTP_ERROR',
        message: ['email must be an email'],
      }),
    });

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      code: 'HTTP_ERROR',
      message: ['email must be an email'],
      correlationId: 'mock-uuid-1234',
    });
  });
  
  it('BFF receives unsafe backend 4xx -> sanitizes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: jest.fn().mockResolvedValue({
        success: false,
        code: 'HTTP_ERROR',
        message: 'ECONNREFUSED 10.0.0.5:5432',
      }),
    });

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      code: 'HTTP_ERROR',
      message: 'An error occurred',
      correlationId: 'mock-uuid-1234',
    });
  });

  it('TEST HTTP PATH: internal array backend error -> BFF -> client receives safe response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: jest.fn().mockResolvedValue({
        success: false,
        code: 'HTTP_ERROR',
        message: ["ECONNREFUSED 10.0.0.5:5432"],
      }),
    });

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(data).toEqual({
      success: false,
      code: 'HTTP_ERROR',
      message: 'An error occurred',
      correlationId: 'mock-uuid-1234',
    });
  });

  it('TEST HTTP PATH: successful response -> BFF -> client receives Cache-Control header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { id: 1 },
      }),
    });

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-correlation-id')).toBe('mock-uuid-1234');
    expect(data).toEqual({
      success: true,
      data: { id: 1 },
    });
  });

  it('No client ID -> BFF generates UUID', async () => {
    mockRequest.headers = new Headers();
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({
        'x-correlation-id': 'mock-uuid-1234',
      }),
    }));
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['x-client-request-id']).toBeUndefined();
  });

  it('Valid-looking client ID -> BFF generates its own trusted ID, preserves client ID', async () => {
    mockRequest.headers = new Headers({ 'x-correlation-id': 'client-provided-id' });
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({
        'x-correlation-id': 'mock-uuid-1234',
        'x-client-request-id': 'client-provided-id',
      }),
    }));
  });

  it('Oversized client ID -> does not become trusted ID, does not get preserved', async () => {
    const hugeId = 'A'.repeat(200);
    mockRequest.headers = new Headers({ 'x-correlation-id': hugeId });
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({
        'x-correlation-id': 'mock-uuid-1234',
      }),
    }));
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['x-client-request-id']).toBeUndefined();
  });

  it('CRLF client ID -> does not become trusted ID, does not get preserved', async () => {
    const maliciousId = 'abc\r\ndef';
    mockRequest.headers = { get: jest.fn().mockReturnValue(maliciousId) };
    
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({
        'x-correlation-id': 'mock-uuid-1234',
      }),
    }));
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['x-client-request-id']).toBeUndefined();
  });

  it('TEST HTTP PATH: network failure -> BFF -> client receives 503 with safe response and correlation ID', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

    const response = await proxyToBackend(mockRequest, 'http://localhost:3000', '/test');
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-correlation-id')).toBe('mock-uuid-1234');
    expect(data.success).toBe(false);
    expect(data.code).toBe('SERVICE_UNAVAILABLE');
    expect(data.correlationId).toBe('mock-uuid-1234');
  });
});
