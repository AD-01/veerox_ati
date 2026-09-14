import { NextRequest } from 'next/server';
import { proxyToBackend, SERVICE_URLS } from '../../../../lib/bff-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  let targetPath = `/${path.join('/')}`;

  if (path[0] === 'symbols' && path.includes('tick')) {
    targetPath = `/market-data/${path.join('/')}`;
  } else if (path[0] === 'providers') {
    targetPath = `/market-data/${path.join('/')}`;
  }

  return proxyToBackend(req, SERVICE_URLS.market, targetPath);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = `/${path.join('/')}`;
  return proxyToBackend(req, SERVICE_URLS.market, targetPath);
}
