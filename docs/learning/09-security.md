# Security

**You will learn:** how to test authentication and authorization properly, what a JWT check must refuse,
how to keep dependencies honest, and how a dynamic scanner finds bugs functional tests miss. ADRs 0012
and 0013 have the reasons.

## OAuth 2.0 and JWTs

The Docker stack includes Keycloak with a test realm (`infrastructure/docker/keycloak/`). Changing a
product needs a bearer token for the order service with the `catalog-admin` role.

| What the service must do                                    | Spec that proves it                               |
| ----------------------------------------------------------- | ------------------------------------------------- |
| No token: 401 with a bare `WWW-Authenticate` challenge      | `data-framework/tests/http/auth.spec.ts`          |
| Valid token without the role: **403**, not 401              | same                                              |
| A token for another API (wrong audience): 401               | same                                              |
| An expired token: 401                                       | same: a client whose tokens live for 2 seconds    |
| Claims edited after signing: 401                            | same, and `apps/order-service/tests/auth.test.ts` |
| An unsigned token (`alg: none`): 401                        | same                                              |
| HS256 signed with the public key (algorithm confusion): 401 | `auth.test.ts`                                    |

401 means "I don't know who you are"; 403 means "I know, and you may not". Mixing them up is a common
bug and a common interview question. Lab 08 hands you a token check that trusts too much.

## Dependencies

- `pnpm security:licences`: every dependency's licence against an open-source allow-list. On its first
  run it found a source-available package pulled in by Lighthouse, now a named exception with the reason.
- `pnpm security:audit` and `pnpm security:osv`: known vulnerabilities. Accepted findings live in
  `osv-scanner.toml` with a reason and an expiry date, so they get looked at again.

## Dynamic scanning (DAST)

`pnpm security:zap` runs OWASP ZAP's API scan against the order service only, driven by its OpenAPI
document and logged in with a Keycloak token. Injection-class rules fail the run.

Its first runs found three real bugs, all now covered by `http/limits.spec.ts`:

1. A price too big for the database column gave a 500 that showed the database's error message.
2. The same value sent through Kafka stopped the service on that message, again on every restart: one
   anonymous request could halt order processing.
3. A NUL character in a product name did the same.

Functional tests missed them because nobody thought to send 2,147,483,648 or a NUL. That is what
scanners and fuzzing are for: inputs nobody imagines.

## Try it

```bash
npx pnpm security                                  # licences, audit, OSV-Scanner
npx pnpm stack:up && npx pnpm security:zap         # reports in .aiqa/zap/
```

The admin console of the test realm is http://localhost:8180 (admin / admin): look at a client, its
roles, and decode one of its tokens at a JWT decoder you run locally.
