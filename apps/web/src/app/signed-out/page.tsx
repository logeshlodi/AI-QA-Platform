import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Signed out' };

const ERRORS: Record<string, string> = {
  'sign-in-failed': 'Signing in did not complete. Try again.',
  'sign-in-expired': 'The sign-in took too long or was started in another tab. Try again.',
  'idp-unreachable':
    'The sign-in service (Keycloak) cannot be reached. Is the stack running? (pnpm stack:up)',
};

export default async function SignedOut({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;
  return (
    <main id="main" className="aiqa-main aiqa-narrow">
      <h1>{message ? 'Not signed in' : 'You are signed out'}</h1>
      {message ? (
        <p role="alert">{message}</p>
      ) : (
        <p>Your session on the dashboard and in Keycloak has ended.</p>
      )}
      <p>
        <a href="/auth/login">Sign in</a>
      </p>
    </main>
  );
}
