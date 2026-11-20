# Lab 08: the token checker that trusts anyone

**Guide:** [Security](../../../../docs/learning/09-security.md), "Verifying a token".

## Symptom

`verifier.ts` decides whether a bearer token may write to the catalogue. It decodes the token, checks
that it has not expired, that it is meant for `order-service` and that it carries the `catalog:write`
role. Every happy-path test passes. Then someone edits a token's payload by hand, or sets `"alg":"none"`,
and gets in.

```bash
pnpm lab 08
```

Three of the five cases in `cases.ts` fail against `verifier.ts`: the tampered token, the unsigned
token and the token signed by a stranger's key.

## Your task

Rewrite `verify()` in `verifier.ts` so every case passes. Keep its signature. You may use `jose`, which
the package already depends on.

## Hints

1. A JWT is three base64url parts. Which part does the naive verifier never look at?
2. Who decides which algorithm is acceptable: the token's header, or the server?
3. Read `apps/order-service/src/auth.ts`: it pins `RS256`, checks issuer and audience, and fetches the
   public keys from a JWKS URL.

## What you should come away with

Decoding is not verifying. A server checks the signature with a key it already trusts, pins the
algorithm, then checks expiry, issuer, audience and scope. Security tests are the cases an attacker
would try: tampered claims, `alg: none`, the wrong key, the wrong audience. `tests/http/auth.spec.ts`
runs the same ideas against the real service and Keycloak.
