# Architecture

How the parts of AI-QA-Platform fit together. The decisions behind them are in [`adr/`](adr).

## Three layers of code

```
specs            packages/playwright-framework/tests, api-framework/tests, data-framework/tests
  │ import
frameworks       playwright-framework, api-framework, data-framework, load-tests, cli
  │ import
engines          self-healing-engine, ai-engine, reporting-engine, test-data-engine
  │ import
shared           env config (zod), demo-target registry, logger, error types
```

Imports only go down. ESLint enforces the two rules that matter most: `shared` never imports
Playwright, and the engines never import the test runner. So the engines are plain TypeScript, unit
tested in milliseconds without a browser, and usable from the CLI or a future agent.

## What runs where

| Suite               | Runner                    | Talks to                                                      | Where it runs                       |
| ------------------- | ------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| UI, smoke, visual   | Playwright, 3 browsers    | Live demo sites (SauceDemo, The Internet, ...)                | Laptop, CI shards, Kubernetes Job   |
| API                 | Playwright `request`      | Restful-Booker, Countries GraphQL, a SOAP calculator          | Laptop, CI                          |
| Data and messaging  | Playwright, no browser    | The order service, Postgres, MongoDB, Kafka                   | Laptop + Docker, CI, Kubernetes Job |
| Browser performance | Playwright + CDP          | SauceDemo, TodoMVC                                            | Laptop, CI                          |
| Contracts           | Vitest + Pact; Playwright | The order service: its OpenAPI document, its consumers' pacts | Laptop + Docker, CI                 |
| Load                | k6                        | The order service only, never a public site                   | Docker, Kubernetes Job              |
| Unit                | Vitest                    | Nothing: fakes and saved DOM snapshots                        | Everywhere, about 8 seconds         |

Every suite starts with a health check of its targets. A target that is down skips its specs with a
`target-down` annotation instead of failing them, so "the site was down" never reads as "the test failed".

## The system under test

The public demo sites cover the browser and API work, but nothing public has Kafka and databases, so
the repository carries its own small service, `apps/order-service`:

```
POST /orders ─┐
              ├─► Kafka orders.placed ─► validate ─► Postgres: order, lines, stock (one transaction)
Kafka client ─┘    (3 partitions,                 ─► MongoDB: audit trail
                    keyed by order id)            ─► Kafka: orders.confirmed | rejected | dlq
GET /orders/:id, PUT /products/:sku, /health, :9464/metrics
```

Partitions are processed in parallel and each one in order, so every event for one order (keyed by
its id) is handled in the sequence it was sent. Stock is locked in SKU order so two orders cannot
deadlock each other.

## How a test run is observed

```
Playwright / k6 ──► run history (.aiqa/history, SQLite or JSON) ──► HTML dashboard, `aiqa` CLI
       └──────────► Pushgateway ─► Prometheus ─► Grafana "Test runs"
order service ────► Prometheus (metrics), Tempo (traces), Loki (logs via Alloy) ─► Grafana
```

The run history is the source of truth and works with nothing else installed. Grafana is the shared
view when the stack is up.

## The AI layer

AI is optional and off by default. With no model, healing uses four rule strategies (test id, role,
text, attributes) and every AI task has a non-AI fallback. With `AI_ENABLED=true` a local model
through Ollama breaks ties in healing and writes failure analyses, bug reports, locators and test data.
Nothing a model returns is trusted as is: a healed locator must match exactly one element and score at
least `HEAL_THRESHOLD` against the stored fingerprint, a generated locator must come from the page's own
accessibility tree, and generated data must pass its zod schema.

## Where it runs

- **Laptop**: everything, including Docker Compose (`pnpm stack:up`) and a kind cluster (`pnpm k8s:up`).
- **GitHub Actions**: the full pipeline on every push and nightly.
- **Azure DevOps** and **Jenkins**: the same stages, for the two CI systems most teams use besides GitHub.
- **Kubernetes** (kind): the stack from one Helm chart, the suites as Jobs, UI Jobs sharing one
  Playwright browser server.
