import { AppShell, type NavItem } from '@aiqa/dashboard';
import type { ReactNode } from 'react';
import { requireViewer } from '@/lib/auth';

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/trends', label: 'Trends' },
  { href: '/flaky', label: 'Flaky tests' },
  { href: '/heals', label: 'Heal audit' },
  { href: '/agents', label: 'Agent runs' },
];

/** Every dashboard page: checks the viewer, then draws the shell around the page. */
export async function Frame({ current, children }: { current: string; children: ReactNode }) {
  const session = await requireViewer(current);
  return (
    <AppShell nav={NAV} current={current} user={{ name: session.name, signOutHref: '/auth/logout' }}>
      {children}
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
