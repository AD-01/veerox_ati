import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SERVICE_URLS, normalizeBffErrorResponse } from '../../../../lib/bff-client';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('ati_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 },
      );
    }

    const identityRes = await fetch(`${SERVICE_URLS.identity}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': req.headers.get('x-correlation-id') || crypto.randomUUID(),
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await identityRes.json().catch(() => ({}));
    if (!identityRes.ok || data.success === false) {
      // Clear cookies on invalid refresh
      cookieStore.delete('ati_access_token');
      cookieStore.delete('ati_refresh_token');
      const safeError = normalizeBffErrorResponse(data, identityRes.status);
      return NextResponse.json(
        { ...safeError, error: safeError.message },
        { status: identityRes.status }
      );
    }

    const { accessToken, refreshToken: newRefreshToken, user } = data.data;

    cookieStore.set('ati_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60,
    });

    if (newRefreshToken) {
      cookieStore.set('ati_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
