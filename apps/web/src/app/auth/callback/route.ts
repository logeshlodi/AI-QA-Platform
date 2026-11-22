import * as client from 'openid-client';
import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { oidc } from '@/lib/oidc';
import {
  LOGIN_COOKIE,
  rolesOf,
  sealSession,
  SESSION_COOKIE,
  SESSION_HOURS,
  unseal,
  type LoginState,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Keycloak sends the browser back here with a code; it is exchanged for tokens and becomes a session. */
export async function GET(request: NextRequest) {
  const login = await unseal<LoginState>(request.cookies.get(LOGIN_COOKIE)?.value);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/signed-out?error=${reason}`, config.appUrl));
    response.cookies.delete({ name: LOGIN_COOKIE, path: '/auth' });
    return response;
  };
  if (!login) return fail('sign-in-expired');
  // The URL Keycloak redirected to, rebuilt on the configured origin so it matches redirect_uri exactly.
  const current = new URL(request.nextUrl.pathname + request.nextUrl.search, config.appUrl);
  let claims: client.IDToken | undefined;
  let idToken: string | undefined;
  try {
    const tokens = await client.authorizationCodeGrant(await oidc(), current, {
      pkceCodeVerifier: login.verifier,
      expectedState: login.state,
      expectedNonce: login.nonce,
      idTokenExpected: true,
    });
    claims = tokens.claims();
    idToken = tokens.id_token;
  } catch {
    return fail('sign-in-failed');
  }
  if (!claims) return fail('sign-in-failed');
  const name =
    (typeof claims.name === 'string' && claims.name) ||
    (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
    claims.sub;
  const session = await sealSession({
    sub: claims.sub,
    name,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    roles: rolesOf(claims),
    idToken,
  });
  const response = NextResponse.redirect(new URL(login.returnTo, config.appUrl));
  response.cookies.delete({ name: LOGIN_COOKIE, path: '/auth' });
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.appUrl.startsWith('https:'),
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
  return response;
}
