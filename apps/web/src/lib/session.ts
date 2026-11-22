import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';
import { sessionSecret } from './config';

/** Who is signed in. Kept in an encrypted, HTTP-only cookie: nothing is stored on the server. */
export interface Session {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
  /** Sent back to Keycloak on sign-out so it ends its own session too. */
  idToken?: string;
}

/** The short-lived state of one sign-in attempt, between the redirect to Keycloak and the callback. */
export interface LoginState {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

export const SESSION_COOKIE = 'aiqa_session';
export const LOGIN_COOKIE = 'aiqa_login';
export const SESSION_HOURS = 8;

async function key(secret = sessionSecret()): Promise<Uint8Array> {
  // A 256-bit key from any long secret: A256GCM needs exactly 32 bytes.
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
}

/** Encrypts (A256GCM, direct key) so the cookie can be neither read nor changed by the browser. */
export async function seal(data: object, ttl: string, secret?: string): Promise<string> {
  return new EncryptJWT(data as JWTPayload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .encrypt(await key(secret));
}

/** The sealed data, or undefined if it is missing, expired, tampered with or sealed with another secret. */
export async function unseal<T>(token: string | undefined, secret?: string): Promise<T | undefined> {
  if (!token) return undefined;
  try {
    const { payload } = await jwtDecrypt(token, await key(secret));
    return payload as T;
  } catch {
    return undefined;
  }
}

export const sealSession = (s: Session, secret?: string) => seal(s, `${SESSION_HOURS}h`, secret);
export const openSession = (token: string | undefined, secret?: string) => unseal<Session>(token, secret);

/**
 * Where to go after signing in: only a path on this app. "//evil.test" and "https://evil.test" are
 * absolute URLs to a browser, so they fall back to the home page (no open redirect).
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

/** Realm roles from the ID token claim the `web` client maps in (`roles`). */
export function rolesOf(claims: Record<string, unknown>): string[] {
  const roles = claims.roles;
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
}
