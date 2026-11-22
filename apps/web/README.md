# web

The platform's web app (Next.js 16, React 19): run history, a run's tests, trends, flaky tests, the heal
audit and the agent run log, behind a Keycloak sign-in. It only reads: the run history, heal audit and
agent log are opened read-only and nothing is created when they are missing. Chat and admin areas
join it in Sprint 13 (decision 3 of the Phase 5 plan: one app, three areas).

```bash
pnpm stack:up                 # Keycloak (and the rest of the stack)
pnpm web                      # http://localhost:3200 (3000 is the stack's Grafana), sign in as qa-viewer / dev-only-qa-viewer-password
pnpm test:web                 # end-to-end and accessibility specs (needs Keycloak, not the rest)
```

## Sign-in

The authorization code flow with PKCE against the `aiqa` realm's `web` client
(`infrastructure/docker/keycloak`). The callback exchanges the code with `openid-client`, checks state
and nonce, and keeps the person in an encrypted (JWE, A256GCM), HTTP-only, SameSite=Lax cookie for
eight hours; nothing is stored on the server. The `roles` claim must hold `dashboard-viewer`, or the
person gets the "no access" page. Signing out ends Keycloak's session too.

`src/proxy.ts` sends anyone without a session to sign in, and every page checks the session and the
role again itself (`requireViewer`), so a matcher change cannot expose a page.

## Settings

| Variable                                              | Default                                        |
| ----------------------------------------------------- | ---------------------------------------------- |
| `APP_URL`                                             | `http://localhost:3200` (redirect URIs use it) |
| `SESSION_SECRET`                                      | required for `next start`; 32+ characters      |
| `AUTH_ISSUER`                                         | `http://localhost:8180/realms/aiqa`            |
| `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`                | `web`, the realm's published test secret       |
| `AUTH_ROLE`                                           | `dashboard-viewer`                             |
| `AIQA_HISTORY_DIR`, `AIQA_HEAL_DIR`, `AIQA_AGENT_LOG` | the repository's own `.aiqa` folders           |

## Tests

`pnpm test:web` seeds a fixed data set (`tests/fixtures/seed.ts`: 12 runs, 2 heals, 3 agent runs),
builds the app and starts it on that data, then:

| Project     | Specs                               | What                                                                                                                                             |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sign-in`   | `auth.setup.ts`                     | Signs in through Keycloak's own page once; saves the session                                                                                     |
| `auth`      | `auth.spec.ts`                      | Return to the page asked for, wrong password, sign-out ends both sessions, no role, open redirect, a changed cookie, an expired sign-in, headers |
| `dashboard` | `dashboard.spec.ts`, `a11y.spec.ts` | Exact numbers on every page, run to test drill-down, axe on every page, keyboard use                                                             |

Unit tests for the session cookie and the return-address check are in `tests/session.test.ts`
(`pnpm test:unit`).
