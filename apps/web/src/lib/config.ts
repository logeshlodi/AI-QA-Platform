import path from 'node:path';

/**
 * Settings, from the environment with local defaults. The defaults match the stack's Keycloak and the
 * repository's own .aiqa folders, so `pnpm --filter @aiqa/web dev` works with no .env at all.
 */
const env = (name: string, fallback: string) => process.env[name]?.trim() || fallback;

/** apps/web is two levels below the repository root. */
// Run-time data folders, not code: kept out of the build's file tracing.
const ROOT = path.resolve(
  /*turbopackIgnore: true*/ env(
    'AIQA_ROOT',
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), '..', '..'),
  ),
);

export const config = {
  /** Where the app is reached in a browser; redirect URIs are built from it, never from the Host header. */
  appUrl: env('APP_URL', 'http://localhost:3200').replace(/\/$/, ''),
  auth: {
    issuer: env('AUTH_ISSUER', 'http://localhost:8180/realms/aiqa'),
    /**
     * Where the server itself reaches the issuer, when that differs from the address browsers use (in
     * Kubernetes: http://keycloak:8080/realms/aiqa). Tokens still name the public issuer.
     */
    internalIssuer: env('AUTH_ISSUER_INTERNAL', ''),
    clientId: env('AUTH_CLIENT_ID', 'web'),
    // The local realm's published test secret (infrastructure/docker/keycloak); set your own anywhere else.
    clientSecret: env('AUTH_CLIENT_SECRET', 'dev-only-web-secret'),
    /** Realm role a person needs to see the dashboard. */
    role: env('AUTH_ROLE', 'dashboard-viewer'),
    /** Realm role that may open the admin area and approve the changes the chat asks for. */
    adminRole: env('AUTH_ADMIN_ROLE', 'platform-admin'),
  },
  data: {
    historyDir: env('AIQA_HISTORY_DIR', path.join(/*turbopackIgnore: true*/ ROOT, '.aiqa', 'history')),
    healDir: env(
      'AIQA_HEAL_DIR',
      path.join(/*turbopackIgnore: true*/ ROOT, 'packages', 'playwright-framework', '.aiqa'),
    ),
    agentLog: env(
      'AIQA_AGENT_LOG',
      path.join(/*turbopackIgnore: true*/ ROOT, '.aiqa', 'agents', 'runs.jsonl'),
    ),
    /** Where chat runs and approvals are logged: the agent run log, unless set apart (the specs do). */
    chatLog: env(
      'AIQA_CHAT_LOG',
      env('AIQA_AGENT_LOG', path.join(/*turbopackIgnore: true*/ ROOT, '.aiqa', 'agents', 'runs.jsonl')),
    ),
    /** Tests quarantined through the chat, after an admin's approval. */
    quarantine: env(
      'AIQA_QUARANTINE_FILE',
      path.join(/*turbopackIgnore: true*/ ROOT, '.aiqa', 'quarantine.json'),
    ),
    /** Chat budgets and switches the admin area changes. */
    settings: env(
      'AIQA_WEB_SETTINGS',
      path.join(/*turbopackIgnore: true*/ ROOT, '.aiqa', 'web-settings.json'),
    ),
  },
};

/** Secret that encrypts the session cookie. Required in production; a fixed value only for `next dev`. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (secret) throw new Error('SESSION_SECRET must be at least 32 characters.');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Set SESSION_SECRET (32+ characters) to run the web app.');
  return 'dev-only-session-secret-for-next-dev-0000';
}
