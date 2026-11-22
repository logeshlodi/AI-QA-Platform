import * as client from 'openid-client';
import { NextResponse, type NextRequest } from 'next/server';
import { oidc, signedOutUrl } from '@/lib/oidc';
import { openSession, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Ends the app's session, then Keycloak's, so the next sign-in asks for the password again. */
export async function GET(request: NextRequest) {
  const session = await openSession(request.cookies.get(SESSION_COOKIE)?.value);
  let target = signedOutUrl();
  try {
    target = client
      .buildEndSessionUrl(await oidc(), {
        post_logout_redirect_uri: signedOutUrl(),
        ...(session?.idToken ? { id_token_hint: session.idToken } : {}),
      })
      .toString();
  } catch {
    // Keycloak unreachable: the app's own session still ends.
  }
  const response = NextResponse.redirect(target);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
