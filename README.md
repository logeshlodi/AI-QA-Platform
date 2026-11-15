# AI-QA-Platform

An AI-assisted Playwright + TypeScript automation platform, built as a pnpm monorepo and tested
against live public demo applications. This is the **working core** (Phases 1 to 3 of the plan):
cross-browser UI tests, API tests, a self-healing engine with an audit trail, and an optional
local-model layer. Every dependency is open source; nothing here needs a paid service.

## Quick start (Windows `cmd`, macOS, Linux)

```bash
npx -y pnpm@10.28.0 install     # first install; pnpm is then a local dev dependency
npx pnpm browsers               # download Chromium, Firefox and WebKit (once)

npx pnpm test:unit              # engines: no browser, no network, about 2 seconds
npx pnpm test:api               # REST, GraphQL and SOAP against live APIs
npx pnpm test:smoke             # SauceDemo smoke on every browser and device project
npx pnpm test:ui                # everything: journeys, locator labs, feature labs, healing, visual
npx pnpm report:html            # open the last HTML report
```

Requires Node 22 or newer. If your global `pnpm` works you can drop the `npx` prefix.

## Packages

| Package                         | What it owns                                                                                                     | Tests                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| `packages/shared`               | Typed env config (zod), demo-target registry, logger, error types                                                | Vitest                |
| `packages/ai-engine`            | `LlmProvider` interface, Ollama adapter, prompt templates, failure analysis, bug-report draft                    | Vitest, fake provider |
| `packages/self-healing-engine`  | Fingerprints, four rule strategies plus a model tie-breaker, scoring, stores (memory, JSON, SQLite), heal report | Vitest                |
| `packages/playwright-framework` | Fixtures, page objects, components, flows, checks, the Playwright healing adapter, all UI specs                  | Playwright            |
| `packages/api-framework`        | REST, GraphQL and SOAP clients, booking builder, zod schemas, API specs                                          | Playwright            |

Import rule, enforced by ESLint: `shared` never imports Playwright, and the two engines never
import the test runner. Specs import the framework; the framework imports the engines; the
engines import `shared`.

## Where the specs are

```
packages/playwright-framework/tests/
  setup/      health check for every target, then one saved login
  smoke/      the cross-browser, cross-device gate
  journeys/   SauceDemo login and checkout flows (Chromium, Firefox, WebKit)
  locators/   one spec per locator type            (Chromium)
  features/   one spec per Playwright feature      (Chromium)
  healing/    self-healing on local pages and on a live dynamic-id page
  visual/     screenshot comparison with built-in toHaveScreenshot
packages/api-framework/tests/
  restful-booker/  auth, CRUD chaining, filtering, data-driven cases
  graphql/         Countries API
  soap/            calculator service
```

`docs/coverage-matrix.md` maps every locator type and feature to its spec file.

## Demo targets

SauceDemo, Restful-Booker, The Internet, UI Testing Playground, Playwright's TodoMVC and
API-mocking demos, the Countries GraphQL API and a public SOAP calculator. The `setup` project
pings each one first. If a target is down, its specs are **skipped** with a `target-down`
annotation rather than failed. To use a local copy, set for example
`TARGET_SAUCEDEMO_URL=http://localhost:3000`.

## Self-healing

```ts
const pay = await healer.locate('PayPage.payButton', page.locator('#btn-1001'));
```

While the locator works, its element is fingerprinted. When it stops working, the engine scores
the elements on the page against that fingerprint and heals only if exactly one is a clear match
(score at least `HEAL_THRESHOLD`, default 0.75, and ahead of the runner-up). Otherwise it refuses
and attaches what it saw.

| `HEAL_MODE`         | Behaviour                                                                   |
| ------------------- | --------------------------------------------------------------------------- |
| `off`               | Plain Playwright                                                            |
| `suggest` (default) | The test fails; the report carries the suggested locator as a diff          |
| `runtime`           | The run continues with the healed element; the heal is logged and annotated |

Source files are never rewritten. See `tests/healing/` for runnable examples.

## Optional: a local model

AI is off by default and nothing depends on it. To turn it on:

```bash
ollama pull qwen2.5-coder:7b
# then in .env
AI_ENABLED=true
```

The model is used for two things only: breaking a tie between elements that all pass the healing
threshold, and classifying failures that no rule matches. Its output is validated against a schema
and it can only choose from a list it is given.

## Useful switches

| Variable                                                                               | Effect                                               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PW_CHANNEL=chrome` or `msedge`                                                        | Run the `chromium` project in your installed browser |
| `PW_BRANDED_BROWSERS=chrome,msedge`                                                    | Add smoke runs in real Chrome and Edge               |
| `HEAL_MODE`, `HEAL_THRESHOLD`, `AI_ENABLED`, `OLLAMA_URL`, `OLLAMA_MODEL`, `LOG_LEVEL` | See `.env.example`                                   |

## Status

See `docs/STATUS.md` for what has been run, where, and what is not built yet.

## Licence

Apache-2.0. See `NOTICE` for the projects this design draws on.
