import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'No access' };
export const dynamic = 'force-dynamic';

export default async function NoAccess({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const session = await currentSession();
  if (!session) redirect('/auth/login');
  const admin = (await searchParams).area === 'admin';
  const role = admin ? config.auth.adminRole : config.auth.role;
  return (
    <main id="main" className="aiqa-main aiqa-narrow">
      <h1>{admin ? 'No access to the admin area' : 'No access to the dashboard'}</h1>
      <p>
        You are signed in as <strong>{session.name}</strong>, but your account does not have the{' '}
        <code>{role}</code> role. Ask whoever runs the Keycloak realm to add it.
      </p>
      <p>
        {admin ? (
          <>
            <a href="/">Back to the dashboard</a> ·{' '}
          </>
        ) : null}
        <a href="/auth/logout">Sign out</a>
      </p>
    </main>
  );
}
