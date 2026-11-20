# 0004. AI is optional, local by default, and never trusted as is

Accepted, November 2026.

## Context

Model output is unreliable, a hosted model costs money and sends page content outside, and a test platform must still work when no model is available.

## Decision

AI is off unless `AI_ENABLED=true`. The default provider is Ollama on the same machine, behind an `LlmProvider` interface so another backend is a one-file change. Every AI task has a non-AI fallback. Output is validated: healed locators by the same check as rule-based ones, generated locators must come from the page's accessibility tree, generated data must pass its zod schema. Page content sent to a model is treated as untrusted input.

## Consequences

The suites run green on a fresh clone with no model. With a model on a CPU-only laptop a call takes about 40 seconds, so AI stays out of the fast path.
