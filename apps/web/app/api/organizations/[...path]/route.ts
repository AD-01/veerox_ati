import { NextRequest } from 'next/server';
import { proxyToBackend, SERVICE_URLS } from '../../../../lib/bff-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = `/organizations/${path.join('/')}`;
  return proxyToBackend(req, SERVICE_URLS.organization, targetPath);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = `/organizations/${path.join('/')}`;
  return proxyToBackend(req, SERVICE_URLS.organization, targetPath);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = `/organizations/${path.join('/')}`;
  return proxyToBackend(req, SERVICE_URLS.organization, targetPath);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = `/organizations/${path.join('/')}`;
  return proxyToBackend(req, SERVICE_URLS.organization, targetPath);
}
