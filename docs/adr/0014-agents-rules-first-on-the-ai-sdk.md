# 0014. Agents: rules first, on the AI SDK, with a budget, approval and a log

Accepted, November 2026.

## Context

Phase 5 adds agents that read run history, propose fixes and answer questions. The laptop runs a 7B
or 8B model on CPU at roughly 40 seconds a call, and small models drop or invent tool calls more often
than large hosted ones. An agent that loops for ten minutes, or acts on a wrong guess, is worse than
no agent.

## Decision

- Agents run on the [AI SDK](https://ai-sdk.dev/docs) (`ai`, Apache-2.0): tool calling, structured
  output and streaming for any model. `chooseModel` in `packages/ai-agents/src/model.ts` is the only
  place that picks one: off by default, Ollama when `AI_ENABLED=true`, or any OpenAI-compatible
  endpoint through `AGENT_PROVIDER`. A hosted key lives only in `.env`; CI never uses one.
- Plain-code rules answer first wherever one clear signal decides. The model is asked only for what
  the rules cannot place. A rule that answers must be right on every eval case it answers.
- `runAgent` enforces, outside the model: a tool-call budget (`AGENT_MAX_TOOL_CALLS`, default 6; the
  tools are withdrawn once it is spent), approval for every `write` tool (default: denied), tool errors
  returned to the model as data, and a schema on the answer. A failed or malformed answer falls back
  to the rules' verdict or to `unknown`, never to a guess.
- Run-time data (error text, page text, titles) is wrapped and labelled as data, not instructions.
- Every run, rule-only ones included, is one line in `.aiqa/agents/runs.jsonl`: input, tool calls,
  answer, source, model, time, tokens.
- Each agent ships with labelled eval cases. Unit tests run them on rules and scripted mock models;
  `pnpm agents:eval` runs them on a real model and fails below the agent's gate.
- The platform's MCP server (`packages/mcp-server`, MCP TypeScript SDK v2) exposes read-only tools
  over the same data, so any MCP client can ask the platform without new code.

## Consequences

Agents are slower to write than a prompt and a loop, but cheap to run, testable without a model, and
honest about what they did not know. LangGraph and similar frameworks were not needed for one-job
agents; revisit if an agent ever needs branching state or long-lived memory.
