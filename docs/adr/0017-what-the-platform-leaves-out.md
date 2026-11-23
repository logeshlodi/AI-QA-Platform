# 0017. What the platform leaves out, on purpose

Date: 2026-11-24. Status: accepted.

## Context

The [capability audit](../capability-audit.md) scores the repository against a 283-item enterprise
Playwright checklist. A checklist is written for every team at once; some items fit a product this
repository does not have, or a machine it does not run on. Building them would add code that
nothing exercises, which is worse than a gap that is written down: it looks covered and is not.

## Decision

Four items are left out, and the audit marks them ➖ (left out on purpose) instead of ❌ (missing):

| Item                      | Why it is left out                                                                                                                                                                            | What would change the decision                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Vue component testing     | There are no Vue components. Component testing is shown with React (`packages/dashboard`), the framework the web app and dashboard use.                                                       | A Vue front end joins the repository.                                              |
| Angular component testing | No Angular components, and Playwright has no Angular adapter for component tests.                                                                                                             | Both of those change.                                                              |
| Excel test data           | Data-driven specs read CSV and YAML (`@aiqa/test-data-engine`): diffable in review, readable by every tool. Excel files are binary in git and need a parser for little gain.                  | A team whose test data lives in spreadsheets: export to CSV, or add a reader then. |
| AI screenshot analysis    | A vision model on the laptop's CPU takes minutes per image, too slow to be part of a test run. Visual checks are pixel comparisons with masks and per-OS baselines, which are exact and fast. | A GPU, or a hosted vision model the team is allowed to send screenshots to.        |

Two more stay partial for the same kind of reason and are recorded as such: driving a real screen
reader (the accessibility tree is checked, which is what a screen reader reads; driving NVDA or
VoiceOver needs a desktop session per OS), and screenshot analysis through the MCP server (the
same vision-model limit).

## Consequences

- The audit's ❌ count means "missing and wanted"; a reader can tell a gap from a choice.
- Each decision says what would reverse it, so it is revisited when that happens rather than
  defended forever.
- Interview answer: "we didn't build X because Y; here is what would make us build it" is a design
  decision, and is stronger than having built everything on a list.
