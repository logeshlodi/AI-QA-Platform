# mcp-server

The platform's own MCP server. Playwright ships the MCP server that drives a browser; this one serves
the platform's data to any MCP client (Claude Code, VS Code, the Phase 5 chat app).

| Tool              | What it returns                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| `list_runs`       | Recorded runs, newest first, with pass rate and failure counts         |
| `run_failures`    | The failed and flaky tests of a run, with the first line of each error |
| `flaky_tests`     | Tests that passed only on retry or flipped between runs                |
| `perf_trends`     | Performance metrics against their usual level, regressions first       |
| `heal_events`     | The self-healing audit trail                                           |
| `make_test_data`  | Seeded customers, products, orders or a whole shop                     |
| `triage_failures` | The Triage agent's verdict for each failed test of a run               |

Every tool only reads. Start it with `pnpm mcp`; the repository's `.mcp.json` registers it for Claude
Code as `aiqa`. `triage_failures` uses a model only when one is configured (`AI_ENABLED=true` or
`AGENT_PROVIDER`, see `.env.example`); otherwise it answers from rules.
