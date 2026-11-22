import { cookies } from 'next/headers';
import { config } from './config';
import { openSession, type Session } from './session';

/**
 * Checks for the JSON API routes: a same-origin JSON request from a signed-in viewer. The session
 * cookie is SameSite=Lax and a cross-site form cannot send JSON, but the Origin check states it.
 */
export async function apiViewer(request: Request): Promise<{ session: Session } | { response: Response }> {
  const origin = request.headers.get('origin');
  if (origin !== new URL(config.appUrl).origin)
    return { response: Response.json({ error: 'cross-origin' }, { status: 403 }) };
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return { response: Response.json({ error: 'json only' }, { status: 415 }) };
  const session = await openSession((await cookies()).get('aiqa_session')?.value);
  if (!session) return { response: Response.json({ error: 'not signed in' }, { status: 401 }) };
  if (!session.roles.includes(config.auth.role))
    return { response: Response.json({ error: 'no access' }, { status: 403 }) };
  return { session };
}

export const isAdmin = (session: Session) => session.roles.includes(config.auth.adminRole);
