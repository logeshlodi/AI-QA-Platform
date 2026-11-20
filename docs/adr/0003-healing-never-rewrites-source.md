# 0003. Self-healing never rewrites source code

Accepted, November 2026.

## Context

A healed locator lets a test pass after the page changed. If that happens silently, a real product change (a removed button, a renamed field) can hide behind a green run.

## Decision

`HEAL_MODE=suggest` is the default: the test still fails and the report carries the proposed locator and a diff. `runtime` uses the healed locator for that run only and logs it. Nothing edits a spec file. A heal must match exactly one element and score at least `HEAL_THRESHOLD` (0.75); anything less is a refusal, recorded like a heal.

## Consequences

Every heal and refusal is in the audit trail. A person still applies the fix. Turning suggestions into pull requests is the natural next step.
