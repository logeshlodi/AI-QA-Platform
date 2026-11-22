# keycloak

`aiqa-realm.json` is imported when the stack's Keycloak starts (`start-dev --import-realm`). It is a
local test realm: every client secret in it is a fixed, published value (`dev-only-<client>-secret`),
which is fine for a throwaway container on your machine and in CI, and never for anything real.

| Client                      | `catalog-admin` | Token audience  | Used for                                        |
| --------------------------- | --------------- | --------------- | ----------------------------------------------- |
| `catalog-admin-cli`         | yes             | `order-service` | Data suites, Pact provider check, k6 set-up     |
| `storefront`                | no              | `order-service` | 403: a valid token without the role             |
| `catalog-admin-short-lived` | yes             | `order-service` | 401: tokens expire after 2 seconds              |
| `other-api-client`          | yes             | `other-api`     | 401: a token meant for a different API          |
| `zap-scanner`               | yes             | `order-service` | The authenticated ZAP scan (tokens last 1 hour) |
| `web`                       | no              | (ID token only) | The web app's browser sign-in (code flow, PKCE) |

All but `web` are service clients (OAuth 2.0 client credentials). `web` signs people in to
`apps/web`, with three test users whose passwords are as published as the secrets:

| User           | Password                         | `dashboard-viewer`        | Used for                               |
| -------------- | -------------------------------- | ------------------------- | -------------------------------------- |
| `qa-viewer`    | `dev-only-qa-viewer-password`    | yes                       | Signing in to the dashboard            |
| `qa-admin`     | `dev-only-qa-admin-password`     | yes, and `platform-admin` | The admin area; approving chat changes |
| `qa-no-access` | `dev-only-qa-no-access-password` | no                        | The "no access" page for the role      |

Keycloak imports the realm only when it does not exist yet. After this file changes, recreate the
container so it imports again: `docker compose -f infrastructure/docker/stack.compose.yml up -d
--force-recreate keycloak`.

The admin console is at http://localhost:8180 (admin / admin) while the stack runs.
