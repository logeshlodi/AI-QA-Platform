import { AppShell, type NavItem } from '@aiqa/dashboard';
import type { ReactNode } from 'react';
import { requireAdmin, requireViewer } from '@/lib/auth';
import { config } from '@/lib/config';
import type { Session } from '@/lib/session';

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/trends', label: 'Trends' },
  { href: '/flaky', label: 'Flaky tests' },
  { href: '/heals', label: 'Heal audit' },
  { href: '/agents', label: 'Agent runs' },
  { href: '/chat', label: 'Chat' },
];
const ADMIN: NavItem = { href: '/admin', label: 'Admin' };

/**
 * Every page: checks the viewer (or the admin, for the admin area), then draws the shell. The page
 * gets the session, so it never has to look it up again.
 */
export async function Frame({
  current,
  admin = false,
  children,
}: {
  current: string;
  admin?: boolean;
  children: ReactNode | ((session: Session) => ReactNode);
}) {
  const session = admin ? await requireAdmin(current) : await requireViewer(current);
  const nav = session.roles.includes(config.auth.adminRole) ? [...NAV, ADMIN] : NAV;
  return (
    <AppShell nav={nav} current={current} user={{ name: session.name, signOutHref: '/auth/logout' }}>
      {typeof children === 'function' ? children(session) : children}
    </AppShell>
  );
}

export function PageHead({ title, lede }: { title: string; lede?: ReactNode }) {
  return (
    <header>
      <h1>{title}</h1>
      {lede ? <p className="aiqa-page-lede">{lede}</p> : null}
    </header>
  );
}

/** Links that pick a suite on the runs and trends pages. */
export function SuitePicker({ suites, current, base }: { suites: string[]; current?: string; base: string }) {
  if (suites.length < 2) return null;
  const items = [{ value: undefined, label: 'All suites' }, ...suites.map((s) => ({ value: s, label: s }))];
  return (
    <nav aria-label="Suite" className="aiqa-filter">
      {items
        .filter((i) => base !== '/trends' || i.value)
        .map((i) => (
          <a
            key={i.label}
            href={i.value ? `${base}?suite=${encodeURIComponent(i.value)}` : base}
            aria-current={i.value === current ? 'page' : undefined}
            className="aiqa-pill"
          >
            {i.label}
          </a>
        ))}
    </nav>
  );
}
