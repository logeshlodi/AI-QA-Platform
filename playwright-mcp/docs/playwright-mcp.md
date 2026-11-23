# Playwright MCP

The repository registers three MCP servers. They do different jobs, and an agent usually needs more
than one.

| Server            | Started by                                                        | What it is for                                                                                |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `playwright`      | root `.mcp.json`, or `pnpm mcp:playwright`                        | Driving a browser: open pages, read them, act, assert, mock the network, save state, record   |
| `playwright-test` | `packages/playwright-framework/.mcp.json` (`run-test-mcp-server`) | Playwright's own planner, generator and healer agents, working on this repository's specs     |
| `aiqa`            | root `.mcp.json`, or `pnpm mcp`                                   | The platform's data: runs, failures, flaky tests, perf trends, heal events, test data, triage |

This page is about the first: [`@playwright/mcp`](https://playwright.dev/mcp/introduction), with every
capability switched on.

## How it is set up

- **One Playwright.** Every `@playwright/mcp` release pins an alpha build of Playwright. The MCP
  server code also ships in stable Playwright, so an override in `pnpm-workspace.yaml` runs it on the
  repository's 1.65.1. There is one Playwright and one set of browsers, and the same version
  answers in the suites and in the MCP. Release 0.0.84 is the one built on 1.65.
- **Every capability.** `packages/mcp-server/playwright-mcp.config.json` turns all of them on.
  Without it the server offers only the 25 core tools.
- **The repository's conventions.** `testIdAttribute` is `data-test`, so generated locators match the
  specs. `codegen` is TypeScript. Output (snapshots, PDFs, screenshots, traces, saved state) goes to
  the git-ignored `.aiqa/playwright-mcp/`.
- **Visible browser by default.** You can watch what the agent does. The tests add `--headless`.

## The tools, by capability

| Capability       | Tools | What they add                                                                                                               |
| ---------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| core (always on) | 25    | Navigate, snapshot, click, type, fill forms, select, drag, upload, dialogs, tabs, console, requests, screenshots            |
| `network`        | 4     | Mock or block requests (`browser_route`, `browser_unroute`, `browser_route_list`), go offline (`browser_network_state_set`) |
| `storage`        | 17    | Cookies, local storage and session storage (list, get, set, delete, clear); save and restore storage state                  |
| `testing`        | 5     | Assertions (`browser_verify_text_visible`, `_element_visible`, `_list_visible`, `_value`) and `browser_generate_locator`    |
| `vision`         | 6     | Mouse by coordinates, for canvas and other places the accessibility tree cannot reach                                       |
| `pdf`            | 1     | `browser_pdf_save`                                                                                                          |
| `devtools`       | 13    | Tracing, video and screencast recording, element highlight, annotations, `browser_resume`                                   |
| `config`         | 1     | `browser_get_config`: what the server was started with                                                                      |

72 tools in all. `packages/mcp-server/tests/playwright-mcp.ts` lists them by group, and the tests fail
if a Playwright upgrade adds, renames or drops one.

## Using it

From Claude Code (or any MCP client that reads `.mcp.json`) in the repository root, the `playwright`
server is already there. Ask in plain words:

> Open https://www.saucedemo.com, sign in as standard_user, add the backpack to the cart, check the
> badge shows 1, and give me the locators you used.

The agent reads the page as an accessibility snapshot, acts on its element references, checks with the
`testing` tools, and `browser_generate_locator` returns the line to paste into a spec.

For another client, or over HTTP:

```bash
npx pnpm mcp:playwright                    # stdio, as .mcp.json starts it
npx pnpm mcp:playwright -- --port 8931     # HTTP, for a client that connects by URL
```

Snapshots are the default and the better choice: they are text, cheap and exact. Use the `vision`
tools only for what has no accessibility tree, such as a canvas chart.

## Tests

| Test                                               | Command                                     | What it proves                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/mcp-server/tests/playwright-mcp.test.ts` | `pnpm test:unit` (CI, no browser)           | It runs on Playwright 1.65.1, the config turns every capability on, all 72 tools are offered, and only the 25 core tools without the config |
| `packages/mcp-server/tests/playwright-mcp.live.ts` | `pnpm test:mcp:playwright` (needs Chromium) | Every capability group, used the way an agent would, against an orders page the test serves itself                                          |

The live test signs in through snapshot references, verifies values, text, an element and a list,
reads the API call, checks local storage and cookies and saves the state, mocks the orders API and
clicks a button by its coordinates, records a trace, and saves a PDF and a full-page screenshot.

## Cautions

- **`browser_run_code_unsafe`** runs any Playwright code the agent writes. It is in core and cannot
  be switched off. Use the server on a trusted machine, against sites you are allowed to test.
- **Secrets.** Do not paste real passwords into a prompt. For a sign-in, use the test accounts the
  demo sites publish. For your own app, use a saved storage state (`browser_set_storage_state`).
- **Where it points.** Load and security testing stay on our own order service and web app. The MCP
  is for exploring and writing tests, not for hammering public sites.
- **Version.** Upgrading Playwright means moving `@playwright/mcp` and the override together. The
  tool-group test says what changed.
