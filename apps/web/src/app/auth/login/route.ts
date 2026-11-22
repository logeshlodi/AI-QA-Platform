import * as client from 'openid-client';
import { NextResponse, type NextRequest } from 'next/server';
import { oidc, redirectUri } from '@/lib/oidc';
import { LOGIN_COOKIE, safeReturnTo, seal } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Starts the authorization code flow with PKCE, a state and a nonce, all kept in a sealed 10-minute cookie. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  let configuration: client.Configuration;
  try {
    configuration = await oidc();
  } catch {
    return NextResponse.redirect(new URL('/signed-out?error=idp-unreachable', request.url));
  }
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(configuration, {
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_COOKIE, await seal({ state, nonce, verifier, returnTo }, '10m'), {
    httpOnly: true,
    sameSite: 'lax', // sent on Keycloak's top-level redirect back to the callback
    secure: request.nextUrl.protocol === 'https:',
    path: '/auth',
    maxAge: 600,
  });
  return response;
}
