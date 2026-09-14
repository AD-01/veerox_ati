import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SERVICE_URLS } from '../../../../../../../lib/bff-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  const { orgId, id } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('ati_access_token')?.value;

  const targetUrl = new URL(`/api/v1/org/${orgId}/workspace/${id}/realtime/stream`, SERVICE_URLS.workspace);
  
  const headers = new Headers();
  headers.set('x-correlation-id', req.headers.get('x-correlation-id') || crypto.randomUUID());
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers,
    });

    if (!backendRes.ok) {
      return new Response(backendRes.body, {
        status: backendRes.status,
        statusText: backendRes.statusText,
        headers: backendRes.headers,
      });
    }

    // Return the readable stream directly to support Server-Sent Events
    return new Response(backendRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
