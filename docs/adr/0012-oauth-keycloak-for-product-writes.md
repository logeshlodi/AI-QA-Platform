# 0012. OAuth 2.0 bearer tokens from Keycloak for product writes

Accepted, November 2026.

## Context

`PUT /products/{sku}` changed the catalogue with no authentication. The Phase 1 plan postponed OAuth
and JWT testing until a local identity provider was available. Most real APIs a tester meets sit
behind OAuth, and the interesting bugs are in what a service accepts: an expired token, one meant
for another API, one whose claims were edited, one with no signature at all.

## Decision

- Keycloak 26 runs in the Docker stack with a test realm imported at start-up
  (`infrastructure/docker/keycloak/aiqa-realm.json`): one realm role, `catalog-admin`, and five
  service clients (client credentials), each set up to produce one test case.
- The order service checks bearer tokens with `jose` against Keycloak's published keys: RS256 only,
  issuer, audience (`order-service`), expiry, and the `catalog-admin` role. Missing token: 401 with a
  bare challenge; bad token: 401 `invalid_token`; valid token without the role: 403
  `insufficient_scope` (RFC 6750). Reading and ordering stay open.
- The issuer is pinned (`KC_HOSTNAME=http://localhost:8180`), so tokens requested from the laptop and
  from inside the Docker network carry the same `iss`; the service fetches keys from inside the network.
- Auth is on only when `AUTH_ISSUER` is set. The Kubernetes chart has no Keycloak, so there it is off,
  the OpenAPI document says so (no security scheme), and the auth spec skips itself.

## Consequences

Every client that writes products now gets a token first: the data suites (a `catalogAdmin`
fixture), the Pact provider check (a request filter swaps the pact's example token for a real one),
k6's set-up and the ZAP scan. Client secrets in the realm are fixed and published: fine for a
throwaway container, never for anything real. The stack takes about 20 seconds longer to start.
