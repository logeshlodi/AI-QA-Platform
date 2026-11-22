import { ISSUER } from './users';

/** Fails early, with the fix, when Keycloak is not running: every spec here signs in through it. */
export default async function globalSetup() {
  const discovery = `${ISSUER}/.well-known/openid-configuration`;
  try {
    const response = await fetch(discovery, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const realm = (await response.json()) as { issuer?: string };
    if (realm.issuer !== ISSUER) throw new Error(`issuer is ${realm.issuer}`);
  } catch (error) {
    throw new Error(
      `Keycloak is not answering at ${discovery} (${(error as Error).message}).\n` +
        'Start it with: pnpm stack:up  (or only Keycloak: docker compose -f infrastructure/docker/stack.compose.yml up -d --wait keycloak).\n' +
        'If it runs but the web client is missing, recreate it so the realm imports again: ... up -d --force-recreate keycloak',
    );
  }
}
