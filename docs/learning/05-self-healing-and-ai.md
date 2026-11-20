# Self-healing and AI

**You will learn:** how a locator can be repaired when the page changes, why a healed test can hide a
real bug, and how to use a model in a test suite without trusting it. Code in
`packages/self-healing-engine/`, `packages/ai-engine/` and `packages/playwright-framework/src/healing/`;
the reasons in ADRs 0003 and 0004.

## How healing works

1. While a locator works, the healer records a **fingerprint** of the element it found: test id, role,
   accessible name, text, attributes, its path in the tree.
2. When the locator later finds nothing, four rule strategies propose candidates from the page
   (by test id, role, text, attributes). Each candidate is **scored** against the fingerprint
   (`scoring.ts`: test id weighs most, 0.45; position in the tree least).
3. **One clear match** (above `HEAL_THRESHOLD`, 0.75 by default, and ahead of the runner-up by a margin)
   is a heal. Several close candidates are **ambiguous**: refused, unless a local model is enabled to
   break the tie. Nothing good enough is a **refusal**. Every outcome is recorded.

What happens next depends on `HEAL_MODE`:

| Mode      | Behaviour                                                                            |
| --------- | ------------------------------------------------------------------------------------ |
| `off`     | Plain Playwright                                                                     |
| `suggest` | The test still fails; the report says which locator would have worked (default)      |
| `runtime` | The healed locator is used for this run and logged; source files are never rewritten |

## Specs

| Spec                            | The point                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `healing/healer-local.spec.ts`  | Fingerprinting; runtime and suggest modes; refusing two identical buttons; refusing when the element is really gone; off mode |
| `healing/dynamic-id.spec.ts`    | Heals an id locator after the live page regenerates the id                                                                    |
| `healing/llm-tiebreak.spec.ts`  | A local model picks the right one of three identical buttons (`AI_ENABLED=true`)                                              |
| `ai/locator-generation.spec.ts` | A model suggests a locator from the aria snapshot, and declines instead of guessing                                           |

## The AI tasks

`packages/ai-engine/src/tasks/`: failure analysis, bug-report drafts, locator generation, element
picking, test data generation. Each one has a non-AI fallback, and each output is checked before use:

- **Failure analysis** classifies a failure as product, test, environment or flaky. Rules decide first
  (free, instant, explainable); the model is asked only for what rules cannot classify.
- **Locator generation** may only pick from elements in the page's own accessibility tree, so it cannot
  invent a selector.
- **Generated data** must pass its zod schema.

The provider is Ollama on the same machine, behind the `LlmProvider` interface; AI is off unless
`AI_ENABLED=true`. Page text sent to a model is untrusted input: a page can contain words aimed at the
model.

## Agents and the MCP server

An agent is a model that may call tools in a loop until it answers. `packages/ai-agents` runs agents
on the AI SDK with the guard rails outside the model ([ADR 0014](../adr/0014-agents-rules-first-on-the-ai-sdk.md)):
a budget of tool calls, approval before any tool that writes, tool errors fed back as data, a schema on
the answer, and one log line per run in `.aiqa/agents/runs.jsonl`.

The **Triage agent** says why a failed test failed. Rules decide first (passed on retry, a network
error, many tests failing the same way, a stale locator); the model gets the rest, with two tools that
read the test's history and the run's other failures. Its 30 labelled cases are in
`src/triage/cases.ts`: rules alone place 23, all correctly; the model has to place enough of the other
seven for the 80% gate.

`packages/mcp-server` serves the platform's data as MCP tools (runs, failures, flaky tests, perf
trends, heal audit, test data, triage), so Claude Code or any MCP client can ask "why did last night's
run fail?" and get an answer from the run history, not from memory.

## Ideas worth being able to explain

- **When not to heal.** A button that moved is a test-maintenance problem; a button that disappeared may
  be a product bug. Silent healing in a release gate turns the second into a green run.
- **Measure the model.** "It usually works" is not a test. The tie-break spec asserts which button it
  chose; the unit tests run the tasks against a fake provider with known answers.
- **Playwright's own agents** (planner, generator, healer, set up in `.claude/agents`) heal test code
  while you write it. This engine heals at run time and leaves an audit trail. They solve different
  problems.

## Try it

```bash
npx pnpm test:ui tests/healing
npx pnpm test:unit                                    # the engines, with a fake model
npx cross-env AI_ENABLED=true pnpm test:ai            # the real local model (slow on a CPU)
npx pnpm aiqa agents triage --suite api               # triage the latest recorded run
npx cross-env AI_ENABLED=true pnpm agents:eval         # score Triage on its 30 cases with your model
npx pnpm aiqa agents log                              # what the agents did
npx pnpm mcp                                          # the MCP server on stdio (Claude Code starts it from .mcp.json)
```
