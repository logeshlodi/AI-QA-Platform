# 15. One Next.js app on Keycloak, and component tests on Playwright's stories

Date: 2026-11-22. Status: accepted.

## Context

Phase 5 needs a dashboard (Sprint 12), then chat and admin (Sprint 13). The run history, heal audit and
agent log already exist; the app only has to read them. The original tree had three app folders and a
shared components package, and component tests were deferred in Phase 1 because there were no
components. Playwright 1.62 replaced its experimental component-testing packages with a stories model
driven by a built-in `mount` fixture, and 1.63 stopped publishing the old packages.

## Decision

- **One Next.js 16 app** (`apps/web`) with the three areas as routes, as decision 3 of the Phase 5
  plan chose. Server components read the stores directly; there is no API layer and no new database.
- **Sign-in through the stack's Keycloak** with a new `web` client: code flow with PKCE via
  `openid-client`, an encrypted cookie session (`jose`), a realm role for access. Each page checks the
  session and role, not only `proxy.ts`.
- **Shared components in `packages/dashboard`**, framework-free React taking plain view models, with a
  story per state.
- **Component tests on the stories model**: a Vite-served gallery implements `window.mount`, and the
  specs use the built-in `mount` fixture. axe runs on every story; screenshots compare against Linux
  baselines made in the Playwright image, like the UI suite's.
- **End-to-end specs sign in through Keycloak's real page** and run on a seeded fixture data set, so
  every number on a page can be asserted exactly.

## Consequences

- The web job in CI needs Keycloak (one container, not the stack).
- Visual baselines must be refreshed in Docker after a deliberate change; they are off on other machines.
- The components cannot use Next.js features (links are plain anchors); that keeps them testable alone.

## Rejected

- Three apps: three builds, three sign-ins and three deploys for one person's dashboard.
- A Vite SPA plus an API server: two things to run, and the data is already on the server's disk.
- Auth.js: v5 is still a beta line and v4 predates the App Router; the flow is a few dozen lines with
  `openid-client`.
- `@playwright/experimental-ct-react`: removed in Playwright 1.63.
- Signing in by minting a cookie in the specs: fast, but it would leave the Keycloak integration untested.
