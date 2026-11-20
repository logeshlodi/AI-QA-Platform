# 0002. Playwright fixtures for dependency injection

Accepted, November 2026.

## Context

Specs need page objects, flows, a healer and quality checks, each with the right lifetime (per test or per worker) and a clean teardown.

## Decision

Playwright fixtures are the container. Independent fixture sets (`healing`, `pages`, `checks`) are combined with `mergeTests` into the one `test` every spec imports. No separate DI library.

## Consequences

Lifetimes, lazy creation and teardown come from the runner and show up in the trace. Singletons are kept to config and the logger: a shared browser, context or page would break parallel workers.
