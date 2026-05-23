/**
 * Web health endpoint. Smoke-tested from update-prod.sh + Caddy upstream
 * checks. Stays under /api so middleware skips it (no locale redirect).
 */

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'reco-web',
      timestamp: new Date().toISOString(),
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
