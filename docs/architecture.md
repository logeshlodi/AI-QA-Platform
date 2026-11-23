# Architecture

How the parts of AI-QA-Platform fit together. The decisions behind them are in [`adr/`](adr).

## Three layers of code

```
apps             web (dashboard, chat, admin), documentation, order-service (system under test)
  │ import
specs            packages/playwright-framework/tests, api-framework/tests, data-framework/tests
  │ import
frameworks       playwright-framework, api-framework, data-framework, load-tests, cli, mcp-server
  │ import
agents           ai-agents (runtime, nine agents, evals), dashboard (React components)
  │ import
engines          self-healing-engine, ai-engine, reporting-engine, test-data-engine
  │ import
shared           env config (zod), demo-target registry, logger, error types
```

Imports only go down. ESLint enforces the two rules that matter most: `shared` never imports
Playwright, and the engines never import the test runner. So the engines are plain TypeScript, unit
tested in milliseconds without a browser, and usable from the CLI, the agents and the web app.

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

## Agents, the MCP server and the web app

```
aiqa agents ... ─┐
MCP client ──────┼─► agent runtime (ai-agents) ─► tools: run history, heal audit, test data, axe, OpenAPI
web app chat ────┘     tool budget, approval for writes,        │
                       run log in .aiqa/agents                  └─► the engines above
web app dashboard ─────────────────────────────────────────────► run history, heal audit, agent log
Keycloak (realm aiqa) ─► sign-in for the web app (dashboard-viewer, platform-admin)
```

Each of the nine agents answers from rules when no model is set, and with a model it may call only its
own tools, a few times per run ([ADR 0014](adr/0014-agents-rules-first-on-the-ai-sdk.md)). The MCP
server (`packages/mcp-server`) offers the same read-only tools to any MCP client, and the web app's
chat calls them in process; the one tool that writes (quarantining a test) waits for a platform admin
to approve it ([ADR 0016](adr/0016-chat-over-mcp-with-approval-and-a-stub-model.md)). The web app is
one Next.js app that only reads data the engines already keep; it has no database of its own
([ADR 0015](adr/0015-one-nextjs-app-and-stories-for-components.md)).

Healing changes reach the code only as patches a person accepts: `aiqa agents heal-review` writes them
to `.aiqa/heal-patches`, and with `--apply --branch` commits them on a local `heal/*` branch. Nothing
is pushed or merged by an agent.

## Design patterns

Each pattern is used where it removes a real problem, not for its own sake.

| Pattern                        | Where                                                                                          | Why it is there                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Page Object                    | `playwright-framework/src/pages`, all extending `BasePage`                                     | locators and actions live once; specs read as user journeys                                                     |
| Component Object               | `src/components` (header, product card)                                                        | parts repeated across pages are defined once and composed into pages                                            |
| Flow (Screenplay-lite)         | `src/flows` (`loginFlow`, checkout)                                                            | a journey over several pages is one call, so specs do not repeat it                                             |
| Fixture (dependency injection) | `src/fixtures` via `test.extend`                                                               | a test asks for what it needs; creation and clean-up are in one place and only run when asked for               |
| Builder                        | `test-data-engine/src/builders.ts` (`anOrder().withLines(...)`)                                | readable test data with sensible defaults; seeded, so a failure replays                                         |
| Strategy                       | `self-healing-engine/src/strategies.ts` (test id, role and name, text, attribute, LLM)         | each way to find a moved element is a class behind one interface; the order is configurable and the LLM is last |
| Factory                        | `ai-engine/src/providers/factory.ts`, the store factories in the healing and reporting engines | the environment chooses Ollama or the fake model, SQLite or JSON; callers see one interface                     |
| Repository                     | `store/repository.ts` in the healing and reporting engines                                     | storage is an interface, so the engines are unit tested with JSON files and run on SQLite                       |
| Adapter                        | `ai-engine` providers, `reporting-engine/src/playwright-reporter.ts`                           | a vendor API or Playwright's reporter interface is translated into our own types at the edge                    |
| Singleton (lazy, resettable)   | `shared/src/env.ts` (`loadEnv()` parses `process.env` once with zod)                           | one validated configuration per process; `resetEnvCache()` keeps it testable, unlike a classic singleton        |
| Command                        | `cli/src/bin.ts` with commander; each command's logic in `cli/src/commands`                    | every CLI action is a small, separately tested function; the binary only wires arguments to it                  |
| Observer                       | the custom reporter, `context.on('requestfinished')` in the `networkLog` fixture               | collecting results and requests without the test knowing                                                        |

### SOLID, in this codebase

- **Single responsibility**: page objects find and act; specs assert; engines decide; reporters record.
- **Open/closed**: a new healing strategy, AI provider or store is a new class registered in a factory,
  with no change to the engine that uses it.
- **Liskov substitution**: the fake model and the JSON store pass the same unit tests as Ollama and
  SQLite, which is what makes them safe stand-ins.
- **Interface segregation**: `LlmProvider` has one method; `HealingStrategy` has one; agents receive
  only the tools they need, not the whole MCP server.
- **Dependency inversion**: the engines depend on interfaces in their own package; Playwright, Ollama
  and SQLite are plugged in from outside. ESLint stops `shared` and the engines importing the runner.

## Where it runs

- **Laptop**: everything, including Docker Compose (`pnpm stack:up`) and a kind cluster (`pnpm k8s:up`).
- **GitHub Actions**: the full pipeline on every push and nightly, and the docs site to GitHub Pages.
- **Azure DevOps** and **Jenkins**: the same stages, for the two CI systems most teams use besides GitHub.
- **Kubernetes** (kind): the stack, Keycloak and the web app from one Helm chart, the suites as Jobs,
  UI Jobs sharing one Playwright browser server.
