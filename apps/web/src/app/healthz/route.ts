export const dynamic = 'force-dynamic';

/** Liveness for the Playwright webServer and containers: answers without a session or Keycloak. */
export function GET() {
  return Response.json({ status: 'ok' });
}
