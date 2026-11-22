import { NAV, RUNS } from '../stories/sample';
import { AppShell } from './AppShell';
import { RunTable } from './RunTable';

export const SignedIn = ({ current = '/runs' }: { current?: string }) => (
  <AppShell nav={NAV} current={current} user={{ name: 'Dashboard Viewer', signOutHref: '/auth/logout' }}>
    <h1>Runs</h1>
    <RunTable runs={RUNS} caption="Recent runs" />
  </AppShell>
);
export const SignedInDark = () => (
  <div data-theme="dark" className="aiqa-theme-root">
    <SignedIn />
  </div>
);
