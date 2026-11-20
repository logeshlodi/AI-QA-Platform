import { stack } from './stack';

/**
 * Service clients of the local test realm (infrastructure/docker/keycloak/aiqa-realm.json). Their
 * secrets are fixed, published, dev-only values: that realm exists only inside the throwaway stack.
 */
export const CLIENTS = {
  /** Has catalog-admin, audience order-service: the allowed case. */
  catalogAdmin: 'catalog-admin-cli',
  /** A valid token without catalog-admin: 403. */
  storefront: 'storefront',
  /** Has catalog-admin, but its tokens expire after 2 seconds. */
  shortLived: 'catalog-admin-short-lived',
  /** Has catalog-admin, but its tokens are for another API (audience other-api). */
  otherApi: 'other-api-client',
} as const;

export type ClientId = (typeof CLIENTS)[keyof typeof CLIENTS];

/** An access token for one of the realm's service clients (OAuth 2.0 client credentials grant). */
export async function clientToken(clientId: ClientId, tokenUrl = stack.tokenUrl): Promise<string> {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: `dev-only-${clientId}-secret`,
    }),
  });
  if (!response.ok)
    throw new Error(`Keycloak refused a token for ${clientId}: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** The token's claims, unverified: for tests that need to read or tamper with them. */
export function claimsOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}
