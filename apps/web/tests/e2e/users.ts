import path from 'node:path';

/** The local realm's published test users (infrastructure/docker/keycloak/README.md). */
export const USERS = {
  viewer: { username: 'qa-viewer', password: 'dev-only-qa-viewer-password', name: 'Dashboard Viewer' },
  admin: { username: 'qa-admin', password: 'dev-only-qa-admin-password', name: 'Platform Admin' },
  noAccess: { username: 'qa-no-access', password: 'dev-only-qa-no-access-password', name: 'No Access' },
} as const;

export const ISSUER = process.env.AUTH_ISSUER ?? 'http://localhost:8180/realms/aiqa';

/** Where the signed-in viewer's cookies are kept between the sign-in step and the specs (git-ignored). */
export const VIEWER_STATE = path.resolve(__dirname, '..', '..', 'playwright', '.auth', 'viewer.json');
export const ADMIN_STATE = path.resolve(__dirname, '..', '..', 'playwright', '.auth', 'admin.json');

/** The fixture data folder the app reads in the specs (tests/fixtures/seed.ts writes it). */
export const FIXTURE_DIR = path.resolve(__dirname, '..', '.fixture-data');
