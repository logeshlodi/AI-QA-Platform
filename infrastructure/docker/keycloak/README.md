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

All are service clients (OAuth 2.0 client credentials): no users, no browser login. The admin console
is at http://localhost:8180 (admin / admin) while the stack runs.
