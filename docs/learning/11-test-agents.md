# 11. Test agents: Playwright's and ours

Two sets of agents plan, write and repair tests in this repository. Playwright's run inside a coding
assistant while you work; ours run from the command line on the platform's own runtime. Both are
reviewed like any other change: nothing an agent writes is merged unread.

## Playwright's agents, in Claude Code

`npx playwright init-agents --loop=claude` put three agent definitions in
`packages/playwright-framework/.claude/agents` and the MCP server they drive in `.mcp.json`. Run them in
order, planner then generator then healer ([Playwright Test Agents](https://playwright.dev/docs/test-agents)).

1. **Open Claude Code in the framework.** `cd packages/playwright-framework` then `claude`. Approve the
   `playwright-test` MCP server when asked; it is `npx playwright run-test-mcp-server` from this repo.
2. **Plan.** Ask: _"Use the playwright-test-planner agent to plan tests for sorting and the cart on the
   SauceDemo inventory page."_ It runs `tests/seed.spec.ts` first (logged in through our fixtures),
   explores the page in a browser, and saves a Markdown plan in `specs/`. Read it; delete what you would
   not test.
3. **Generate.** Ask: _"Use the playwright-test-generator agent to generate tests for scenario 1 of
   specs/<plan>.md."_ It replays the steps in a real browser, checks each locator and assertion live,
   and writes a spec under `tests/`.
4. **Heal.** Break a test on purpose (change one locator in a page object), run it, then ask: _"Use the
   playwright-test-healer agent to fix the failing test <title>."_ It replays the test, looks for the
   same element in the current page, patches the test and runs it again. If it decides the feature
   itself is broken, it skips the test rather than forcing it green.
5. **Review the diff** with `git diff`. Check every locator is a role, label or test id, every wait is a
   web-first assertion, and no assertion was weakened to make a test pass.

Running them uses your Claude plan. Nothing in this repository runs them for you.

## Our agents, from the command line

The same three jobs on the platform's runtime ([ADR 0014](../adr/0014-agents-rules-first-on-the-ai-sdk.md)),
with the local model or a hosted one:

```bash
pnpm test:ui --project=auth                                 # once: saves the SauceDemo session
pnpm aiqa agents plan inventory --path /inventory.html --logged-in --focus "sorting and the cart"
pnpm aiqa agents generate specs/inventory.plan.md --scenario 1
pnpm aiqa agents heal-review                                # proposals only
pnpm aiqa agents heal-review --apply                        # asks before writing each patch
```

- **Planner**: reads the page's accessibility tree once and asks the model for 3 to 6 scenarios, in the
  same Markdown layout as Playwright's planner, so either generator can use either plan.
- **Generator**: one model call per scenario, then the spec has to lint clean and pass three runs in a
  row with no retries. A failure goes back to the model once with the errors; a spec that still fails
  is moved out of `tests/` to `.aiqa/agents/rejected/` for you to read.
- **Healing review**: turns heal events from the self-healing engine into a one-line patch to a page
  object, with a pull-request description. It refuses when the old locator appears more than once,
  only in a spec, or on an assertion line.

## The other five agents

The same rules apply to the rest of the platform's agents: plain code decides what it can, the model
does one job, and code checks the model's answer before anyone sees it.

| Agent         | The model's job                            | What code checks                                                                      |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Flaky hunter  | Names the likely cause from the errors     | Which tests are flaky (history), whether they still are (reruns)                      |
| API tester    | Proposes cases from the OpenAPI document   | Operation exists, status documented, body valid exactly when success is expected      |
| Test data     | Proposes edge-case records                 | Every record passes its schema; code builds any edge the model missed                 |
| Accessibility | Ranks axe findings by what users cannot do | Every finding keeps axe's own level if the model skips it                             |
| Run reporter  | Words the run summary                      | Every number must be in the run history, every failure named, or the template is used |

`pnpm agents:eval:all` runs every agent against its labelled cases with your model and records the
scores in the run history as suite `agents`, so a model change that makes an agent worse shows up.

## How they differ

|                       | Playwright's agents                            | Ours                                                                                                       |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Where they run        | Inside a coding assistant, while you work      | `aiqa agents …`, in a terminal or CI                                                                       |
| How they see the page | Drive a live browser step by step through MCP  | One accessibility snapshot (planner); real test runs (generator)                                           |
| Model                 | The assistant's (a large hosted model)         | Local Ollama by default, or any OpenAI-compatible model                                                    |
| Healing               | Edits the failing test, reruns it, may skip it | Run-time healing records an event; the agent proposes a page-object patch and writes it only with your yes |
| What it may change    | Any file the assistant can edit                | `specs/`, `tests/generated/`, and approved one-line patches in `src/pages`, `src/components`, `src/flows`  |
| Proof it worked       | The generator checks steps live; you rerun     | Lint plus three passing runs, recorded in the agent log                                                    |
| Cost                  | Your assistant plan                            | Local CPU time, or your hosted model's tokens                                                              |

Use Playwright's agents to explore and write tests quickly with a strong model beside you. Use ours
where the work must be repeatable and logged, or must run without a person at the keyboard.

## Ideas worth being able to explain

- **A healer can hide a bug.** If a button disappeared because the product broke, "healing" the locator
  turns a real failure green. Both healers guard against this differently: Playwright's may skip the
  test; ours never patches an assertion and asks a person before writing.
- **Generated tests need the same review as written ones.** Check locators, waits and that each
  assertion checks what the scenario says.
- **Small local models need more structure.** Our agents make one model call per job and let code do
  the checking; a large model can be trusted with a longer loop.

## Try it

```bash
pnpm test:ui tests/healing/heal-review.spec.ts   # a healed locator becomes a patch that works
pnpm aiqa agents log                             # what every agent did
pnpm aiqa quiz --topic ai
```
