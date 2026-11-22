import type { ReactNode } from 'react';
import type { NavItem } from '../types';

export interface AppShellProps {
  nav: NavItem[];
  /** The current path, to mark the active link. */
  current: string;
  user?: { name: string; signOutHref: string };
  children: ReactNode;
}

/** Page frame: skip link, product name, main navigation, the signed-in user, and the page content. */
export function AppShell({ nav, current, user, children }: AppShellProps) {
  const isCurrent = (href: string) =>
    href === '/' ? current === '/' : current === href || current.startsWith(`${href}/`);
  return (
    <div className="aiqa-shell">
      <a className="aiqa-skip" href="#main">
        Skip to content
      </a>
      <header className="aiqa-header">
        <a className="aiqa-brand" href="/">
          AI-QA Platform
        </a>
        <nav aria-label="Main">
          <ul className="aiqa-nav">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {user ? (
          <div className="aiqa-user">
            <span>
              Signed in as <strong>{user.name}</strong>
            </span>
            <a href={user.signOutHref}>Sign out</a>
          </div>
        ) : null}
      </header>
      <main id="main" className="aiqa-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
