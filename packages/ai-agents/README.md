# ai-agents

Nine agents on one small runtime, built on the [AI SDK](https://ai-sdk.dev/docs)
([ADR 0014](../../docs/adr/0014-agents-rules-first-on-the-ai-sdk.md)). Each agent has one job, a fixed
set of tools, a plain-code answer when no model is configured, and an eval with a pass mark.

| Agent          | Job                                                                   | Without a model                   | Folder          |
| -------------- | --------------------------------------------------------------------- | --------------------------------- | --------------- |
| Triage         | Why a failed test failed: product, test, flaky or environment         | Rules on the error text           | `src/triage`    |
| Healing review | A heal suggestion as a patch and a pull-request description           | The patch, no description         | `src/healing`   |
| Planner        | A Markdown test plan from a live page                                 | None: needs a model               | `src/planner`   |
| Generator      | A spec from one plan scenario, kept only if it passes 3 runs in a row | None: needs a model               | `src/generator` |
| Flaky hunter   | Flaky tests from the history, rerun, with the likely cause            | The report from the history       | `src/flaky`     |
| API tester     | API cases for the order service from its OpenAPI document             | Schema-driven cases               | `src/api`       |
| Test data      | Valid and edge-case records for a schema                              | The seeded builders               | `src/data`      |
| Accessibility  | axe findings ranked by what users cannot do                           | axe's own impact levels           | `src/a11y`      |
| Run reporter   | A run summary whose every number is checked against the history       | A template                        | `src/reporter`  |
| Test selection | The specs a change can affect, riskiest first, each with its reason   | Import graph, impact map, history | `src/selection` |
| Spec review    | Changed specs against CONTRIBUTING's standards, by line               | The rules, with line numbers      | `src/review`    |

## Memory: people decide once

`src/memory.ts` keeps what people decided about agent output (`.aiqa/agents/decisions.jsonl`, written
only by `aiqa agents feedback` and the heal-review prompt, never by an agent):

- **Triage**: a label a person gave this test for this failure (the error with numbers and ids
  blanked) answers next time, before the rules and without the model (`source: 'memory'`). Labels for
  other tests that failed the same way go to the model as `<past-decisions>` examples.
- **Healing review**: a fix a person declined is not offered again; a different fix for the same
  locator still is.

Records that fail the schema are skipped, not trusted. Evals pass `skipRules`, which also skips
memory, so they measure the agent itself.

## The runtime

- `runAgent` (`src/runtime.ts`) gives the model a budget of tool calls (6 by default). Past it the
  tool is not run and the model is told to answer; the run then stops.
- Tools are read-only unless marked as writing; a writing tool runs only after an approval callback
  says yes (the CLI asks you, the web app asks a platform admin).
- Tool output is passed to the model as data, never as instructions.
- `chooseModel` (`src/model.ts`) is the one place that picks the model: off by default,
  `AI_ENABLED=true` for Ollama, `AGENT_PROVIDER=openai-compatible` with `AGENT_BASE_URL`,
  `AGENT_MODEL` and `AGENT_API_KEY` for a hosted one.
- Every run is appended to `.aiqa/agents/runs.jsonl`: prompt, tool calls, answer, model, time and
  tokens. `aiqa agents log` and the web app's agent page read it.

## Running and testing

```bash
npx pnpm aiqa agents --help        # every agent as a CLI command
npx pnpm agents:eval:all           # all nine evals; rules only unless a model is on
npx pnpm test:unit                 # the runtime and agents against mock models
```

Unit tests use the AI SDK's mock models, so they are fast and give the same answer every time. The
evals score the real model; Sprint 11's scores are in `docs/STATUS.md`.
