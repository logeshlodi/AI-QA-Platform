# Learning path

This repository is built to be learned from. The route below takes you through it in thirteen stops, from
running your first spec to tests running as Kubernetes Jobs. Each stop has four parts:

- **Read**: a guide in this folder, which points at the specs and source that show the idea.
- **Run**: the command that shows it working on your machine.
- **Do**: a break-it lab in [`packages/examples`](../../packages/examples): a spec with one planted mistake to find and fix.
- **Check**: `pnpm aiqa quiz --topic <topic>` asks interview questions on that stop and names the files that answer them.

About a week a stop, at 45 to 60 minutes a day, alongside the study guide.

| #   | Stop                              | Read                                                      | Run                                                                  | Do          | Check topic   |
| --- | --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | ----------- | ------------- |
| 1   | Run it and read the config        | [Framework design](03-framework-design.md)                | `pnpm test:smoke`                                                    | —           | `framework`   |
| 2   | Locators                          | [Locators](01-locators.md)                                | `pnpm test:ui tests/locators`                                        | Labs 02, 03 | `locators`    |
| 3   | Waiting and assertions            | [Playwright features](02-playwright-features.md)          | `pnpm test:ui tests/features/assertions`                             | Labs 01, 04 | `waiting`     |
| 4   | Fixtures, page objects, isolation | [Framework design](03-framework-design.md)                | `pnpm test:shuffle`                                                  | Lab 05      | `framework`   |
| 5   | Network, state and the browser    | [Playwright features](02-playwright-features.md)          | `pnpm test:ui tests/features`                                        | Lab 06      | `network`     |
| 6   | API testing                       | [API testing](04-api-testing.md)                          | `pnpm test:api`                                                      | Lab 07      | `api`         |
| 7   | Data and messaging                | [Data and messaging](06-data-and-messaging.md)            | `pnpm stack:up && pnpm test:data`                                    | —           | `data`        |
| 8   | Self-healing and AI               | [Self-healing and AI](05-self-healing-and-ai.md)          | `pnpm test:ui tests/healing`                                         | —           | `ai`          |
| 9   | Performance                       | [Performance](07-performance.md)                          | `pnpm test:perf`, `pnpm perf:load`                                   | —           | `performance` |
| 10  | Contracts                         | [Contracts](08-contracts.md)                              | `pnpm test:contract`                                                 | —           | `contracts`   |
| 11  | Security                          | [Security](09-security.md)                                | `pnpm security`, `pnpm security:zap`                                 | Lab 08      | `security`    |
| 12  | CI, observability, Kubernetes     | [CI, observability and Kubernetes](10-ci-and-platform.md) | `pnpm k8s:up && pnpm k8s:test data`                                  | —           | `platform`    |
| 13  | Test agents                       | [Test agents: Playwright's and ours](11-test-agents.md)   | `pnpm aiqa agents plan inventory --path /inventory.html --logged-in` | —           | `ai`          |

## How to use a stop

1. Read the guide once, quickly. Then open the specs it names next to it and read them properly: the
   comments in them explain why, not what.
2. Run the command. Open the HTML report (`pnpm report:html`) and a trace of one test
   (`npx playwright show-trace <trace.zip>`): most of what the guides describe is visible there.
3. Do the lab without opening its `solution.spec.ts`. The README tells you the symptom, not the cause.
4. Take the quiz. Answer out loud before revealing the answer: in an interview you will have no notes.
5. Change something and watch what breaks. A spec you have broken on purpose is one you understand.

## Where the decisions are explained

[`docs/architecture.md`](../architecture.md) shows how the parts fit together, and
[`docs/adr`](../adr) records why each big choice was made, what it costs, and what was rejected.
Interviewers ask "why" far more often than "how"; those files are the "why".
