import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SERVICE_URLS, normalizeBffErrorResponse } from '../../../../lib/bff-client';

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

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('ati_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Dev-mode bypass: if the token matches the dev token, return mock session
    if (process.env.NODE_ENV === 'development' && accessToken === 'dev-access-token-veerox-ati') {
      return NextResponse.json({
        success: true,
        data: DEV_USER_SESSION,
      });
    }

    const identityRes = await fetch(`${SERVICE_URLS.identity}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-correlation-id': req.headers.get('x-correlation-id') || crypto.randomUUID(),
      },
    });

    const data = await identityRes.json().catch(() => ({}));
    if (!identityRes.ok || data.success === false) {
      const safeError = normalizeBffErrorResponse(data, identityRes.status);
      return NextResponse.json(
        { ...safeError, error: safeError.message },
        { status: identityRes.status }
      );
    }
    return NextResponse.json(data, { status: identityRes.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
