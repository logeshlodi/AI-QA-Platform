import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from './config';
import { openSession, SESSION_COOKIE, type Session } from './session';

/** The signed-in person, or undefined. */
export async function currentSession(): Promise<Session | undefined> {
  return openSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Every dashboard page calls this, not only the proxy: a page must not rely on a matcher to be
 * protected. No session sends the person to sign in; a session without the role sees "no access".
 */
export async function requireViewer(returnTo: string): Promise<Session> {
  const session = await currentSession();
  if (!session) redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (!session.roles.includes(config.auth.role)) redirect('/no-access');
  return session;
}

/** The admin area: the viewer role and the admin role. Anyone else sees "no access". */
export async function requireAdmin(returnTo: string): Promise<Session> {
  const session = await requireViewer(returnTo);
  if (!session.roles.includes(config.auth.adminRole)) redirect('/no-access?area=admin');
  return session;
}
