# 0013. Security gates: licences, known vulnerabilities, and a ZAP scan of our own API

Accepted, November 2026.

## Context

The project's first rule is open-source dependencies only, but nothing enforced it. Known
vulnerabilities were checked by hand (`pnpm audit`), and nothing attacked the order service.

## Decision

- `pnpm security:licences` fails on any dependency whose licence is outside an allow-list of
  open-source licences. Exceptions are named, one package each, with the reason.
- `pnpm security:audit` (`pnpm audit --audit-level high`) and `pnpm security:osv` (OSV-Scanner v2 in
  Docker, reading `pnpm-lock.yaml`) check for known vulnerabilities. Accepted findings live in
  `osv-scanner.toml` with a reason and an `ignoreUntil` date, after which they fail again.
- `pnpm security:zap` runs ZAP's API scan against the order service only, driven by its own OpenAPI
  document and authenticated with a Keycloak token. Injection-class rules (SQL, NoSQL, XSS, command,
  path traversal, SSRF, XXE, template injection) fail the run; everything else is reported.
- CI runs the first three in a `security` job and the ZAP scan in a `dast` job.

## Consequences

The licence check found a source-available package on day one: `sentry` (FSL-1.1), pulled in by
Lighthouse. It is a named exception rather than silently allowed. Ignored vulnerabilities expire, so
they are looked at again. ZAP's image is about 4 GB unpacked, which matters on a nearly full disk.
