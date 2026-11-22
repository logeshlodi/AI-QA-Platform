# Testing a web app you own: components, sign-in, accessibility, visuals

Everything before this stop tested someone else's site (SauceDemo, Restful-Booker) or a service.
`apps/web` is a page the platform owns, so it can be tested at every level, and the levels can be
chosen on purpose.

## Four levels, one job each

| Level      | Where                                 | Catches                                         | Costs                     |
| ---------- | ------------------------------------- | ----------------------------------------------- | ------------------------- |
| Unit       | `apps/web/tests/session.test.ts`      | Logic with many cases: the return-address check | Nothing; milliseconds     |
| Component  | `packages/dashboard/tests/components` | A component's states, keyboard use, axe         | A dev server, no back end |
| End to end | `apps/web/tests/e2e`                  | Sign-in, routing, real data on real pages       | Keycloak and a built app  |
| Visual     | `visual.spec.ts` (`@visual`)          | Layout and colour changes nobody asserted       | Baselines per OS, upkeep  |

A rule of thumb: test a state where it is cheapest to reach. "No runs recorded" is one story; reaching
it end to end would need an empty database and a sign-in.

## Component tests on stories (Playwright 1.62+)

Read `packages/dashboard/README.md`, then `src/components/TrendChart.story.tsx` and
`tests/components/chart-and-shell.spec.ts`.

- A story is one named state. Prefer a new story to a parameter: stories are documentation you can grep.
- `mount('TrendChart/PassRate')` navigates to the gallery and renders that story; it returns a locator
  for `#root`, so queries start there.
- `component.update(props)` re-renders without remounting, so state survives (the shell's active link).
- The old `@playwright/experimental-ct-react` (JSX in the test file) was removed in 1.63. Its tests
  passed functions as props; stories keep callbacks inside the browser instead.

## Signing in for real

`auth.setup.ts` signs in once through Keycloak's own login page and saves the cookies; the dashboard
specs reuse them (`storageState`). `auth.spec.ts` starts with no session and checks what can go wrong:
a wrong password, a person without the role, an open redirect in `returnTo`, a changed cookie, a
callback with no sign-in behind it, and sign-out ending Keycloak's session as well as the app's.

Minting a session cookie in the test would be faster, and many suites do it for the specs that are
not about sign-in. Here the sign-in step runs once per run, so the cost is a few seconds, and the
Keycloak integration stays tested.

## Exact numbers need fixed data

The app reads `AIQA_HISTORY_DIR`, `AIQA_HEAL_DIR` and `AIQA_AGENT_LOG`. The specs point them at a data
set `tests/fixtures/seed.ts` writes before the server starts, so "ui: pass rate 80%, 1 failed, 1 flaky"
is a fact the spec can assert, not a range.

## Accessibility and visuals

axe runs on every story and every page (WCAG 2.2 AA). It finds missing names, contrast and structure
problems, not whether a chart makes sense without a mouse: `chart-and-shell.spec.ts` checks that by
hand (arrow keys, the table view). Screenshots are compared only in the Linux image that made the
baselines (`PW_VISUAL=1`); a font difference between Windows and Linux is not a bug.

## Run

```bash
pnpm test:components
pnpm stack:up && pnpm test:web
```

## Questions to answer out loud

1. Why are the component tests not end-to-end tests with a fixture database?
2. What would break if `requireViewer` were removed from the pages but `proxy.ts` stayed?
3. Why does `safeReturnTo` reject `//evil.example` when it starts with a slash?
4. When would you mint a session cookie in a test instead of signing in through Keycloak?
