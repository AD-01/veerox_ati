import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isSafePublicMessage } from '@veerox/shared/src/errors/safe-error.util';

const getUrl = (name: string, val: string | undefined, fallback: string) => {
  if (process.env.NODE_ENV !== 'development') {
    if (!val) throw new Error(`${name} is required in production`);
    if (val.includes('localhost') || val.includes('127.0.0.1')) {
      throw new Error(`Production ${name} cannot be localhost`);
    }
    return val;
  }
  return val || fallback;
};

export const SERVICE_URLS = {
  identity: getUrl('IDENTITY_SERVICE_URL', process.env.IDENTITY_SERVICE_URL, 'http://localhost:3001'),
  organization: getUrl('ORGANIZATION_SERVICE_URL', process.env.ORGANIZATION_SERVICE_URL, 'http://localhost:3002'),
  workspace: getUrl('WORKSPACE_SERVICE_URL', process.env.WORKSPACE_SERVICE_URL, 'http://localhost:3003'),
  strategy: getUrl('STRATEGY_SERVICE_URL', process.env.STRATEGY_SERVICE_URL, 'http://localhost:3004'),
  risk: getUrl('RISK_SERVICE_URL', process.env.RISK_SERVICE_URL, 'http://localhost:3005'),
  portfolio: getUrl('PORTFOLIO_SERVICE_URL', process.env.PORTFOLIO_SERVICE_URL, 'http://localhost:3006'),
  execution: getUrl('EXECUTION_SERVICE_URL', process.env.EXECUTION_SERVICE_URL, 'http://localhost:3007'),
  market: getUrl('MARKET_SERVICE_URL', process.env.MARKET_SERVICE_URL, 'http://localhost:3008'),
  ai: getUrl('AI_SERVICE_URL', process.env.AI_SERVICE_URL, 'http://localhost:3009'),
  decision: getUrl('DECISION_SERVICE_URL', process.env.DECISION_SERVICE_URL, 'http://localhost:3010'),
  billing: getUrl('BILLING_SERVICE_URL', process.env.BILLING_SERVICE_URL, 'http://localhost:3012'),
  licensing: getUrl('LICENSING_SERVICE_URL', process.env.LICENSING_SERVICE_URL, 'http://localhost:3013'),
  marketplace: getUrl('MARKETPLACE_SERVICE_URL', process.env.MARKETPLACE_SERVICE_URL, 'http://localhost:3014'),
};

export function normalizeBffErrorResponse(data: any, status: number) {
  if (status >= 500) {
    return {
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    };
  }

  if (process.env.NODE_ENV === 'development') {
    return data;
  }

  const message = data?.message;
  const isSafe = isSafePublicMessage(message);

  return {
    success: false,
    code: data?.code || 'HTTP_ERROR',
    message: (isSafe && message) ? message : 'An error occurred'
  };
}

export async function proxyToBackend(
  req: NextRequest,
  baseUrl: string,
  targetPath: string,
) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('ati_access_token')?.value;

  const url = new URL(targetPath, baseUrl);
  // Forward search query params
  req.nextUrl.searchParams.forEach((val, key) => {
    url.searchParams.set(key, val);
  });

  const trustedCorrelationId = crypto.randomUUID();
  const rawClientId = req.headers.get('x-correlation-id');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-correlation-id': trustedCorrelationId,
  };

  if (rawClientId && rawClientId.length <= 100 && !rawClientId.match(/[\x00-\x1F\x7F]/)) {
    headers['x-client-request-id'] = rawClientId;
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Forward specific tenant and idempotency headers if present
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  const organizationId = req.headers.get('x-organization-id');
  if (organizationId) {
    headers['x-organization-id'] = organizationId;
  }

  const workspaceId = req.headers.get('x-workspace-id');
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  let body: string | undefined = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const json = await req.json();
      body = JSON.stringify(json);
    } catch {
      // empty or non-json body
    }
  }

  const responseHeaders = {
    'Cache-Control': 'no-store, max-age=0',
    'x-correlation-id': trustedCorrelationId,
  };

  try {
    const backendRes = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const data = await backendRes.json().catch(() => ({}));
    
    if (backendRes.status >= 400) {
      const errorResponse = normalizeBffErrorResponse(data, backendRes.status);
      return NextResponse.json(
        { ...errorResponse, correlationId: trustedCorrelationId },
        { status: backendRes.status, headers: responseHeaders }
      );
    }

    return NextResponse.json(data, { status: backendRes.status, headers: responseHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable', correlationId: trustedCorrelationId },
      { status: 503, headers: responseHeaders },
    );
  }
}
