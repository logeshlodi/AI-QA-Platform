# Playwright's test agents against ours

Playwright 1.65 ships three test agents: a **planner**, a **generator** and a **healer**. Their
definitions are in `packages/playwright-framework/.claude/agents/` and they drive Playwright's test
MCP server (`.mcp.json` in the same folder). This platform has its own planner, generator and healing
review ([ADR 0014](adr/0014-agents-rules-first-on-the-ai-sdk.md)). This page sets both on the same
three tasks and scores them with the same checks our evals use.

The Playwright agents run inside Claude Code, so a person starts them. Our agents run from the CLI.
`pnpm aiqa agents compare` scores what either produced.

## The three tasks and how they are scored

| Task | Both sides get                                                       | Passes when                                                                           | Scored by                         |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| Plan | SauceDemo's inventory page, signed in as `standard_user`             | It names elements, and at most 20% of the quoted names are not on the live page       | `aiqa agents compare plan <file>` |
| Spec | Scenario 1 of `specs/inventory.plan.md`, with `tests/seed.spec.ts`   | It lints clean, type-checks and passes 3 runs in a row in Chromium, no retries        | `aiqa agents compare spec <file>` |
| Heal | `tests/generated/heal-task.spec.ts`: a button's generated id changed | It passes 3 runs, the broken locator is gone, and no assertion was removed or changed | `aiqa agents compare heal`        |

The healing task is the same breakage as the Sprint 10 heal-review spec, on a page set with
`setContent`, so no public site is involved and every run sees the same page. The assertion check
follows this platform's own rule: healing changes locators in page objects, never a spec or an
assertion ([ADR 0003](adr/0003-healing-never-rewrites-source.md), `packages/ai-agents/src/healing/agent.ts`).

Record for each: pass or fail, time taken, and how many edits you made before accepting the result.

## Before you start

```powershell
pnpm install
pnpm test:ui --project=auth          # saves the SauceDemo session the plan task reads the page with
```

Open Claude Code in `packages/playwright-framework` (the folder with `.claude/agents` and `.mcp.json`)
and approve the `playwright-test` MCP server when it asks.

## 1. Plan

**Playwright's planner.** In Claude Code:

> Use the playwright-test-planner agent. Seed: tests/seed.spec.ts. Plan tests for the SauceDemo
> inventory page (https://www.saucedemo.com/inventory.html): sorting, adding and removing products,
> and the cart badge. Save the plan as specs/inventory-playwright.plan.md.

**Ours** (from the repository root, with a model on):

```powershell
$env:AI_ENABLED='true'; $env:AGENT_MODEL='qwen3:8b'; $env:AGENT_THINK='false'
pnpm aiqa agents plan inventory-ours --path /inventory.html --logged-in --focus "sorting, adding and removing products, the cart badge"
```

**Score both:**

```powershell
pnpm aiqa agents compare plan specs/inventory-playwright.plan.md specs/inventory-ours.plan.md --logged-in
```

## 2. Spec

**Playwright's generator.** In Claude Code:

> Use the playwright-test-generator agent. Generate a test for scenario 1 of specs/inventory.plan.md,
> using tests/seed.spec.ts as the seed and this project's fixtures and page objects. Save it as
> tests/generated/inventory-1-playwright.spec.ts.

**Ours:**

```powershell
pnpm aiqa agents generate specs/inventory.plan.md --scenario 1
```

**Score both** (ours keeps its spec only when it passed; the file name comes from the scenario title):

```powershell
pnpm aiqa agents compare spec tests/generated/inventory-1-playwright.spec.ts
pnpm aiqa agents compare spec tests/generated/<our-file>.spec.ts
```

## 3. Heal

**Playwright's healer:**

```powershell
pnpm aiqa agents compare heal-task
```

Then in Claude Code:

> Use the playwright-test-healer agent to fix tests/generated/heal-task.spec.ts.

```powershell
pnpm aiqa agents compare heal       # scores it, then moves the file out of the suite
```

**Ours.** Our healing works at run time, inside the `Healer` fixture, and turns what it healed into a
patch a person accepts (`aiqa agents heal-review`). The Sprint 10 gate spec runs exactly this breakage
through it:

```powershell
pnpm --filter @aiqa/playwright-framework exec playwright test tests/healing/heal-review.spec.ts --project=chromium
```

It passes when the suggestion is `getByRole('button', { name: 'Pay now' })`, the patch applies, and the
patched page object then works.

## Results

Both sides ran on 23 Nov on the Windows laptop: ours on `qwen3:8b` on CPU with thinking off (and
`qwen2.5-coder:7b` for the spec), Playwright's in Claude Code. The healing task on Playwright's side is
still to run.

| Task | Playwright's agent (Claude Code)                                          | Ours (`qwen3:8b`, CPU)                                                                                        |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Plan | PASS: 23 scenarios in 4 groups, 44 steps, every named element on the page | PASS: 3 scenarios, 15 steps, 21 named elements; one ("Remove") appears only after a product is added, 4.6 min |
| Spec | PASS: lint clean, type-checks, 3 runs in a row                            | FAIL on `qwen3:8b` (compiles, never signs in); PASS on `qwen2.5-coder:7b`, first attempt, 3.0 min             |
| Heal | not run yet                                                               | PASS: the heal-review gate spec (suggestion, patch applies, page object works again)                          |

The unhealed task scores FAIL (locator not replaced, the run fails), as it should.

What the first two tasks show: Playwright's planner explored the page through the browser and wrote
far more (23 scenarios, including reloads, the cart page, the product page, `problem_user` and
`error_user`); ours reads one accessibility tree and writes three. Playwright's generator records
steps it performed, so its spec passed first time; ours writes code from examples and needed the
type check to stop `qwen3:8b` calling page-object members that do not exist.

Scoring Playwright's plan found a bug in our tooling: its layout (groups, `#### 1.1` scenarios,
**Steps:** labels) was not the one our parser assumed, so it read as 0 steps. `parsePlan` now reads
both layouts, which also lets our generator take Playwright's plans.

## What to expect

- Playwright's agents explore the live page through the browser, so a plan can cover flows behind
  clicks. Ours reads one accessibility tree in one model call: cheaper and repeatable, but it sees one
  page only.
- Playwright's generator records the steps it performs, so its locators are ones it has seen work.
  Ours writes code from the plan and the examples, then lints and runs it, and tries again with the
  errors.
- Playwright's healer edits the spec until it passes. Nothing stops it weakening an assertion, which is
  why the score checks for that. Ours never edits a test: it suggests, and a person accepts the patch.
