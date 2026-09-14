import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SERVICE_URLS, normalizeBffErrorResponse } from '../../../../lib/bff-client';
import { rateLimitLogin } from '../../../../lib/rate-limit';

// Dev-mode test credentials (bypasses identity-service when backend is unavailable)
const DEV_TEST_USER = {
  email: 'admin@veerox.ai',
  password: 'Admin@1234',
};

const DEV_USER_SESSION = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@veerox.ai',
  username: 'admin',
  firstName: 'Veerox',
  lastName: 'Admin',
  roles: ['Admin', 'Trader'],
  workspaceId: '00000000-0000-0000-0000-000000000010',
  organizationId: '00000000-0000-0000-0000-000000000100',
};

async function handleDevLogin(body: { email: string; password: string }) {
  if (body.email === DEV_TEST_USER.email && body.password === DEV_TEST_USER.password) {
    const cookieStore = await cookies();

    // Use a static dev token
    const devToken = 'dev-access-token-veerox-ati';
    cookieStore.set('ati_access_token', devToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    cookieStore.set('ati_refresh_token', 'dev-refresh-token-veerox-ati', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({
      success: true,
      user: DEV_USER_SESSION,
    });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid email or password' },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Use req.ip directly, relying on Next.js/infrastructure trusted proxies. Fallback to localhost if undefined.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ip = (req as any).ip || '127.0.0.1';
    
    // Normalize email for rate limit key
    const email = body.email ? String(body.email).toLowerCase() : 'unknown';
    
    // Protect against massive payloads / memory exhaustion
    if (email.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Invalid email' },
        { status: 400 }
      );
    }
    
    const limitResult = await rateLimitLogin(ip, email, 'closed');

    if (!limitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts or authentication service unavailable. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    // In development, try the real identity service first, fall back to dev bypass
    if (process.env.NODE_ENV === 'development') {
      try {
        const identityRes = await fetch(`${SERVICE_URLS.identity}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': req.headers.get('x-correlation-id') || crypto.randomUUID(),
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000), // 3s timeout
        });

        const data = await identityRes.json().catch(() => ({}));
        if (!identityRes.ok || data.success === false) {
          const safeError = normalizeBffErrorResponse(data, identityRes.status);
          return NextResponse.json(
            { ...safeError, error: safeError.message },
            { status: identityRes.status }
          );
        }

        const { accessToken, refreshToken, user } = data.data;
        const cookieStore = await cookies();

        cookieStore.set('ati_access_token', accessToken, {
          httpOnly: true,
          secure: String(process.env.NODE_ENV) === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60,
        });

        if (refreshToken) {
          cookieStore.set('ati_refresh_token', refreshToken, {
            httpOnly: true,
            secure: String(process.env.NODE_ENV) === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return NextResponse.json({ success: true, user });
      } catch {
        // Identity service unreachable — fall back to dev bypass
        console.warn('[DEV] Identity service unreachable, using dev bypass login');
        return handleDevLogin(body);
      }
    }

    // Production: always proxy to identity service
    const identityRes = await fetch(`${SERVICE_URLS.identity}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': req.headers.get('x-correlation-id') || crypto.randomUUID(),
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify(body),
    });

    const data = await identityRes.json().catch(() => ({}));
    if (!identityRes.ok || data.success === false) {
      const safeError = normalizeBffErrorResponse(data, identityRes.status);
      return NextResponse.json(
        { ...safeError, error: safeError.message },
        { status: identityRes.status }
      );
    }

    const { accessToken, refreshToken, user } = data.data;
    const cookieStore = await cookies();

    cookieStore.set('ati_access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60,
    });

    if (refreshToken) {
      cookieStore.set('ati_refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
