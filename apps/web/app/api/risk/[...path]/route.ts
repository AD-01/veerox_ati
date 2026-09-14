import { NextRequest } from 'next/server';
import { proxyToBackend, SERVICE_URLS } from '../../../../lib/bff-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (path[0] === 'profile' && workspaceId) {
    targetPath = `/workspaces/${workspaceId}/risk-profile`;
  } else if (path[0] === 'assessments' || path[0] === 'evaluate') {
    targetPath = `/api/v1/risk/${path.join('/')}`;
  }

  return proxyToBackend(req, SERVICE_URLS.risk, targetPath);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (path[0] === 'profile' && workspaceId) {
    targetPath = `/workspaces/${workspaceId}/risk-profile`;
  } else if (path[0] === 'assessments' || path[0] === 'evaluate') {
    targetPath = `/api/v1/risk/${path.join('/')}`;
  }

  return proxyToBackend(req, SERVICE_URLS.risk, targetPath);
}
