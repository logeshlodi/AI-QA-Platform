import path from 'node:path';

/** The local realm's published test users (infrastructure/docker/keycloak/README.md). */
export const USERS = {
  viewer: { username: 'qa-viewer', password: 'dev-only-qa-viewer-password', name: 'Dashboard Viewer' },
  noAccess: { username: 'qa-no-access', password: 'dev-only-qa-no-access-password', name: 'No Access' },
} as const;

export const ISSUER = process.env.AUTH_ISSUER ?? 'http://localhost:8180/realms/aiqa';

/** Where the signed-in viewer's cookies are kept between the sign-in step and the specs (git-ignored). */
export const VIEWER_STATE = path.resolve(__dirname, '..', '..', 'playwright', '.auth', 'viewer.json');
