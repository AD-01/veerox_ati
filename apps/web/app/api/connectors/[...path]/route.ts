import { NextRequest } from 'next/server';
import { proxyToBackend, SERVICE_URLS } from '../../../../lib/bff-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (orgId && workspaceId) {
    if (path[0] === 'trading-accounts') {
      targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/trading-accounts${path.length > 1 ? `/${path.slice(1).join('/')}` : ''}`;
    } else {
      targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors${path.length > 0 ? `/${path.join('/')}` : ''}`;
    }
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (orgId && workspaceId) {
    if (path[0] === 'trading-accounts') {
      targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/trading-accounts${path.length > 1 ? `/${path.slice(1).join('/')}` : ''}`;
    } else {
      targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors${path.length > 0 ? `/${path.join('/')}` : ''}`;
    }
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (orgId && workspaceId) {
    targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors/${path.join('/')}`;
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const orgId = req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id');

  let targetPath = `/${path.join('/')}`;
  if (orgId && workspaceId) {
    targetPath = `/organizations/${orgId}/workspaces/${workspaceId}/connectors/${path.join('/')}`;
  }

  return proxyToBackend(req, SERVICE_URLS.workspace, targetPath);
}
