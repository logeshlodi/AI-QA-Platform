# Specs

Test plans written by the Playwright **planner** agent land here as Markdown. The **generator** agent
turns a plan into spec files under `tests/`, and the **healer** agent repairs failing ones.

The agent definitions live in `.claude/agents/` and the MCP server they drive is declared in `.mcp.json`
(`npx playwright run-test-mcp-server`). They were created with:

```
npx playwright init-agents --loop=claude --project=chromium
```

Run the same command with `--loop=vscode`, `copilot`, `codex` or `opencode` to generate definitions for
another tool, and again after every Playwright upgrade so the definitions match the installed version.

Every plan starts from `tests/seed.spec.ts`, which logs in to SauceDemo through this project's fixtures.
Generated tests are reviewed like any other code; nothing an agent writes is merged unread.
