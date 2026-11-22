import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'No access' };
export const dynamic = 'force-dynamic';

export default async function NoAccess() {
  const session = await currentSession();
  if (!session) redirect('/auth/login');
  return (
    <main id="main" className="aiqa-main aiqa-narrow">
      <h1>No access to the dashboard</h1>
      <p>
        You are signed in as <strong>{session.name}</strong>, but your account does not have the{' '}
        <code>{config.auth.role}</code> role. Ask whoever runs the Keycloak realm to add it.
      </p>
      <p>
        <a href="/auth/logout">Sign out</a>
      </p>
    </main>
  );
}
