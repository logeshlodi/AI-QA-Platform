# Walkthrough: showing the platform in ten minutes

How to show this repository to an interviewer or a team: five demos, each with what to run, what
they see, and the decision behind it, which is what the questions will be about. Run them in this
order; each takes about two minutes. Commands are for the repository root on a machine that has run
`npx pnpm install` and `npx pnpm exec playwright install`.

Before you start: `npx pnpm test:api` once (it needs nothing but the internet), so the history has a
run to show, and `npx pnpm stack:up` if you will show demo 4's data side.

## 1. A failure explains itself, and remembers your correction

```bash
npx pnpm test:api                                   # or any suite with a failure in it
npx pnpm aiqa agents triage --suite api             # product, test, flaky or environment, with evidence
npx pnpm aiqa agents feedback triage <id> product --note "tax dropped in 4.2, BUG-311"
npx pnpm aiqa agents triage --suite api             # now answered from your decision
```

**They see:** each failed test labelled, the evidence it rests on and a next step; after the feedback,
the same failure answered "from memory", naming who decided and why.

**The decision:** rules first, the model only for what rules cannot place
([ADR 0014](adr/0014-agents-rules-first-on-the-ai-sdk.md)). Rules are instant, free and right
every time they answer (the eval checks that). Memory holds people's decisions only, never the
agent's own answers: memory that learns from itself drifts.

**Likely questions:** _How do you know the model is any good?_ Thirty labelled failures and a gate
(`npx pnpm aiqa agents eval triage`). _What stops prompt injection from an error message?_ Error text
reaches the model wrapped as data, and the agent cannot write anything.

## 2. A broken locator heals, and a person decides

```bash
npx pnpm --filter @aiqa/playwright-framework exec playwright test tests/healing --project=chromium
npx pnpm aiqa agents heal-review --apply             # one patch per healed locator, asks before writing
```

**They see:** a test that would have failed on a changed id passes, the healing engine's reasoning
(strategy, score), then a one-line page-object patch with a pull-request description, and a yes/no
prompt. Say no once: the same fix is never offered again.

**The decision:** healing never rewrites source on its own ([ADR 0003](adr/0003-healing-never-rewrites-source.md)).
A heal is evidence the locator is fragile; the fix goes through review like any other change.
`--branch` puts approved patches on a local `heal/*` branch for a pull request.

## 3. Only the tests a change can break, riskiest first

```bash
git switch -c demo && echo "// demo" >> packages/playwright-framework/src/pages/saucedemo/cart.page.ts
npx pnpm aiqa select                                 # what this branch can break, and why
npx pnpm aiqa select --budget 5 --run                # the riskiest five minutes of it, run now
git checkout -- . && git switch - && git branch -D demo
```

**They see:** one spec selected out of 65 (the checkout journey uses the cart page through the
checkout flow), and 64 listed as "loads the code but does not use it". Change the network log instead
and every spec is selected: it runs in an auto fixture.

**The decision:** an import graph, a small `test-impact.json` for code tested from outside (the web
app, the order service), and the run history for risk. The model may add specs, never remove them,
and only real paths. Compared with Playwright's `--only-changed`, which follows imports too: this
also ranks by failure history, covers black-box services, explains each pick and fits a time budget.

## 4. The run history, flaky tests and the dashboards

```bash
npx pnpm report:dashboard                            # pass rates, durations, flaky tests, heals
npx pnpm aiqa flaky                                  # tests that pass and fail on the same code
npx pnpm aiqa agents review                          # this branch's specs against CONTRIBUTING
```

**They see:** trends across runs, the tests that flip, and a spec review by line ("must" and
"should", with the CONTRIBUTING section each comes from).

**The decision:** the history lives in Node's built-in SQLite ([ADR 0006](adr/0006-run-history-sqlite-with-json-fallback.md)),
so there is no service to run; Grafana gets the same numbers through a Pushgateway for teams that
already watch dashboards ([ADR 0010](adr/0010-test-metrics-through-pushgateway.md)).

## 5. AI that drives the browser, and agents compared honestly

```bash
npx pnpm test:mcp:playwright                         # Playwright MCP, every tool group, on a local page
npx pnpm mcp:smoke                                   # our MCP server: runs, failures, flaky tests as tools
```

Then open [Agents vs Playwright](agents-vs-playwright.md): Playwright's own planner and generator
against ours, on the same task and the same checks.

**They see:** an agent's view of a page (an accessibility snapshot with element references), and the
platform's data answering questions over MCP.

**The decision:** three MCP servers, each with one job ([Playwright MCP](playwright-mcp.md)), on the
repository's own Playwright version. Every write an agent proposes waits for a person
([ADR 0016](adr/0016-chat-over-mcp-with-approval-and-a-stub-model.md)).

## If you have two minutes

Demo 1 and demo 3. Say: "Failures are triaged by rules first and a model second, and it remembers
when I correct it. Before a merge, it picks only the tests the change can break and runs the riskiest
first. Every AI answer is checked, logged and evaluated against labelled cases."

## If they ask about scale and CI

- The same suites run in GitHub Actions, Jenkins and Azure DevOps, and as Kubernetes Jobs on a kind
  cluster ([ADR 0009](adr/0009-kind-helm-and-test-jobs.md)); `pnpm test:matrix` runs the deployment
  smoke against the Docker stack and the cluster in one run.
- A real incident: Jenkins and Azure DevOps on one laptop built every push at once and took each
  other's Docker stack down. The fix was a machine-wide lock (`scripts/ci-lock.mjs`) and a `stack:up`
  that prints why a service did not come up. [Status](STATUS.md) has the timeline.

## What to leave out

Do not run the full UI suite live (twenty minutes), load tests, or anything against a public site
beyond the demo sites the suites already use. If something fails during a demo, demo 1 is the answer.
