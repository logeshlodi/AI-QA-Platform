# Troubleshooting

The failures people actually hit in this repository, what causes them, and the fix. Each one has
happened at least once on the Windows laptop or in CI (see [status](STATUS.md)).

## Install and set-up

| Symptom                                           | Cause                                                                  | Fix                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm: command not found`                         | pnpm is not installed globally                                         | Use `npx pnpm ...`; the repository pins the version in `package.json` |
| `ERR_PNPM_OUTDATED_LOCKFILE` in CI                | a `package.json` changed without the lockfile                          | `npx pnpm install` and commit `pnpm-lock.yaml`                        |
| `Executable doesn't exist at ...ms-playwright...` | browsers not downloaded for this Playwright version                    | `npx pnpm exec playwright install chromium firefox webkit`            |
| `Host system is missing dependencies` (Linux)     | system libraries for the browsers                                      | `npx pnpm exec playwright install --with-deps chromium`               |
| Licence gate fails after adding a package         | the package or one of its dependencies is not under an allowed licence | pick another package; do not widen the allow-list for one dependency  |
| `husky` hooks do not run                          | `core.hooksPath` not set after cloning                                 | `npx pnpm install` again (the `prepare` script sets it)               |

## Running tests

| Symptom                                                      | Cause                                                         | Fix                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Many specs **skipped** with "target down"                    | a public demo site did not answer the health check in `setup` | Wait or check the site; the run is not a failure. The `cleanup` project attaches the target status                                         |
| `strict mode violation: ... resolved to 2 elements`          | the locator matches more than one element                     | Narrow it: a role with `name`, `exact: true`, or scope it with `.filter()` / a parent locator. Do not add `.first()` to hide it            |
| `Timed out 5000ms waiting for expect(locator).toBeVisible()` | the element never appeared, or the locator is wrong           | Open the trace (`npx pnpm report:html`, then the trace icon) and look at the DOM snapshot at that step                                     |
| A test passes alone and fails in the full run                | it depends on data or order                                   | `npx pnpm test:shuffle`; give the test its own data, or a test lock if the resource cannot take two writers                                |
| Flaky only in CI                                             | slower machine, no warm cache                                 | Look for a fixed wait or a missing web-first assertion; never raise the timeout first                                                      |
| `Cannot use({ launchOptions }) in a describe group`          | `launchOptions` and `channel` start a new worker              | Move `test.use({ launchOptions })` to the top of its own spec file                                                                         |
| `defaultBrowserType` error when using a device in `test.use` | device descriptors carry the browser                          | `test.use({ ...devices['iPad Pro 11'], defaultBrowserType: undefined })`                                                                   |
| Screenshot differs by a few pixels on another machine        | fonts and rendering differ by OS                              | Update baselines on Linux (in CI or the Docker image) with `npx pnpm --filter @aiqa/playwright-framework snapshots:update`, not on Windows |
| `Notification.permission` is `denied` even after granting    | the Chromium headless shell has no notifications              | That spec uses `channel: 'chromium'` (full Chromium)                                                                                       |

## Debugging

- `npx pnpm test:debug -- tests/journeys/checkout.spec.ts` opens the inspector and pauses before
  each action; `PWDEBUG=1` does the same for any command.
- UI mode, to watch and re-run one test with its timeline: `npx pnpm --filter @aiqa/playwright-framework exec playwright test --ui`.
- A failed test always has a trace, a screenshot and, from the `networkLog` fixture, a
  `network-log` attachment listing every request with its status and duration.
- `AIQA_SEED=<seed from the report>` replays the same generated data.

## Local stack and Kubernetes

| Symptom                                              | Cause                                        | Fix                                                                                      |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `stack:up` hangs at "waiting"                        | a container failed its health check          | `docker compose -f infrastructure/docker/stack.compose.yml ps` then `logs <service>`     |
| Port already in use (5432, 8080, 9092...)            | another container or service holds it        | Stop the other one, or change the host port in the compose file                          |
| `attempt to write a readonly database` in a k8s step | Jobs wrote `.aiqa` as root on a Linux runner | `sudo chown -R "$(id -u):$(id -g)" .aiqa` before the host step (already in the workflow) |
| `k8s:test` Job stuck in `Pending`                    | the image was not loaded into kind           | `npx pnpm k8s:up` loads it; check `npx pnpm k8s:status`                                  |
| Docker Desktop uses most of drive C:                 | its virtual disk only grows                  | Docker Desktop → Troubleshoot → Clean / Purge data, then compact the disk                |

## Web app and Keycloak

| Symptom                                 | Cause                                            | Fix                                                                                       |
| --------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `test:web` fails at sign-in             | Keycloak is not up or the realm was not imported | `npx pnpm stack:up` (it starts Keycloak with the realm) and wait for it to report healthy |
| Admin specs see another spec's settings | two specs change the same settings file          | They run in the `admin` and `security` projects, one after the other, by design           |

## AI features

| Symptom                          | Cause                                              | Fix                                                                            |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| AI commands say "AI is off"      | `AI_PROVIDER` is not set                           | Set it in `.env` (`ollama` for local)                                          |
| Ollama calls time out            | the model is still loading, or too big for the CPU | `ollama ps`; use `qwen3:8b` with `AGENT_THINK=false` on a CPU-only laptop      |
| Healing suggests a wrong locator | the model guessed from too little DOM              | Healing is only ever a patch for review (`aiqa agents heal-review`); reject it |
