import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SERVICE_URLS } from '../../../../lib/bff-client';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('ati_access_token')?.value;

    if (accessToken) {
      await fetch(`${SERVICE_URLS.identity}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-correlation-id': req.headers.get('x-correlation-id') || crypto.randomUUID(),
        },
      }).catch(() => {});
    }

    cookieStore.delete('ati_access_token');
    cookieStore.delete('ati_refresh_token');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
