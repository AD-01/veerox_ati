import { NextRequest } from 'next/server';
import { proxyToBackend, SERVICE_URLS } from '../../../lib/bff-client';

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = '/connectors';
  if (orgId && workspaceId) {
    targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors`;
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}

export async function POST(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = '/connectors';
  if (orgId && workspaceId) {
    targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors`;
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}
