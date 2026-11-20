import type { Question } from './types';

/**
 * The question bank. Every answer is backed by code in this repository: `files` lists where to look,
 * and a unit test fails if any of those paths stops existing. Outlines are the points a strong answer
 * covers, not a script to recite.
 */
export const QUESTIONS: readonly Question[] = [
  // ── framework ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'framework-1',
    topic: 'framework',
    level: 'core',
    question: 'What is a Playwright fixture, and why use one instead of beforeEach?',
    outline: [
      'A fixture is a named dependency a test asks for by destructuring it; Playwright builds it on demand and tears it down after.',
      'Set-up and tear-down live in one function around `use()`, so clean-up cannot be forgotten.',
      'Fixtures compose: one can depend on another, and only the ones a test asks for are built.',
      'Scope is per test by default, or per worker for expensive things like a database connection.',
      'Here, page objects, healing and checks are fixtures merged with `mergeTests` into one `test`.',
    ],
    files: [
      'packages/playwright-framework/src/fixtures/index.ts',
      'docs/adr/0002-fixtures-for-dependency-injection.md',
    ],
  },
  {
    id: 'framework-2',
    topic: 'framework',
    level: 'core',
    question: 'How do you structure page objects so tests stay readable as the app grows?',
    outline: [
      'A page object owns locators and actions for one page; tests say what the user does, not how.',
      'Locators are defined once, as Playwright locators (lazy), not as strings or element handles.',
      'Repeated parts of a page (a header, a product card) become components; multi-page journeys become flows.',
      'Assertions stay in the test, except checks that are part of an action ("the page loaded").',
      'A base page holds what every page shares, such as navigation and a ready check.',
    ],
    files: [
      'packages/playwright-framework/src/pages/base.page.ts',
      'packages/playwright-framework/src/pages/saucedemo/inventory.page.ts',
      'packages/playwright-framework/src/components/product-card.component.ts',
      'packages/playwright-framework/src/flows/checkout.flow.ts',
    ],
  },
  {
    id: 'framework-3',
    topic: 'framework',
    level: 'senior',
    question: 'A test passes alone but fails in the full suite. How do you find and fix the cause?',
    outline: [
      'Suspect shared state: module variables, a record in a database, a logged-in session, test order.',
      'Reproduce with the suite in random order (`--shuffle`) and with more workers, or run the failing test alone and then right after its neighbours.',
      'Fix by giving each test what it needs: a fixture, its own data, its own storage state.',
      'Keep a shuffled run in CI so the problem cannot come back unnoticed.',
    ],
    files: [
      'packages/playwright-framework/tests/features/locks-and-shuffle.spec.ts',
      'packages/playwright-framework/tests/setup/auth.setup.ts',
    ],
    lab: '05-shared-state',
  },
  {
    id: 'framework-4',
    topic: 'framework',
    level: 'senior',
    question: 'How do you log in once and reuse it across hundreds of tests?',
    outline: [
      'A setup project logs in and saves cookies and local storage with `storageState()`.',
      'Browser projects depend on the setup project and load that file through `use.storageState`.',
      'Tests start already logged in, and the login itself is tested once, on its own.',
      'Different roles get different state files; a test that needs a fresh session opts out.',
    ],
    files: [
      'packages/playwright-framework/tests/setup/auth.setup.ts',
      'packages/playwright-framework/playwright.config.ts',
      'packages/playwright-framework/tests/features/auth-storage-state.spec.ts',
    ],
  },
  {
    id: 'framework-5',
    topic: 'framework',
    level: 'architect',
    question: 'How would you lay out a test platform that serves UI, API and data testing for several teams?',
    outline: [
      'A monorepo of small packages with clear direction: shared utilities, engines with no test-runner dependency, then frameworks that use them.',
      'Enforce the boundaries with lint rules, not convention.',
      'One version of each tool across packages (a pnpm catalog), so upgrades happen once.',
      'Record decisions as ADRs, so the next person knows why, not only what.',
    ],
    files: [
      'pnpm-workspace.yaml',
      'eslint.config.mjs',
      'docs/architecture.md',
      'docs/adr/0001-pnpm-workspace-and-catalog.md',
    ],
  },

  // ── locators ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'locators-1',
    topic: 'locators',
    level: 'core',
    question: 'Which locator do you reach for first, and why?',
    outline: [
      '`getByRole` with an accessible name: it matches how users and assistive technology see the page.',
      'Then label, placeholder or text for form fields and content; a test id when there is no good user-facing handle.',
      'CSS and XPath last: they tie the test to the page structure, which changes most often.',
      'A role locator that cannot be written is often an accessibility bug worth reporting.',
    ],
    files: [
      'packages/playwright-framework/tests/locators/role.spec.ts',
      'packages/playwright-framework/tests/locators/test-id.spec.ts',
      'packages/playwright-framework/tests/locators/xpath.spec.ts',
    ],
    lab: '02-brittle-locator',
  },
  {
    id: 'locators-2',
    topic: 'locators',
    level: 'core',
    question: 'What is strict mode, and why is `.first()` usually the wrong fix for it?',
    outline: [
      'A locator used for an action must match exactly one element, or Playwright throws.',
      '`.first()` silences that by picking whichever element comes first, which may not be the one you meant.',
      'Narrow instead: filter a list item by its text or a child, or chain from a container.',
      'Use `nth` only when position is the point of the test.',
    ],
    files: [
      'packages/playwright-framework/tests/locators/filter.spec.ts',
      'packages/playwright-framework/tests/locators/chaining-within.spec.ts',
      'packages/playwright-framework/tests/locators/nth.spec.ts',
    ],
    lab: '03-strict-mode',
  },
  {
    id: 'locators-3',
    topic: 'locators',
    level: 'senior',
    question: 'How do you locate elements inside iframes and shadow DOM?',
    outline: [
      'Frames: `page.frameLocator()` or `locator.contentFrame()`, then locate inside it as usual.',
      'Open shadow DOM: Playwright CSS and role locators pierce it by default; XPath does not.',
      'Closed shadow roots cannot be reached by any locator; test through the public behaviour.',
    ],
    files: [
      'packages/playwright-framework/tests/locators/frames.spec.ts',
      'packages/playwright-framework/tests/locators/shadow-dom.spec.ts',
    ],
  },
  {
    id: 'locators-4',
    topic: 'locators',
    level: 'senior',
    question: 'A cookie banner or survey pops up at random and breaks tests. What do you do?',
    outline: [
      'Register `page.addLocatorHandler()` for the overlay: Playwright runs the handler whenever it blocks an action.',
      'Better still, set the cookie or flag that stops it appearing, in the storage state.',
      'Do not wrap every click in try/catch or sleep before it.',
    ],
    files: ['packages/playwright-framework/tests/locators/locator-handler.spec.ts'],
  },
  {
    id: 'locators-5',
    topic: 'locators',
    level: 'senior',
    question: 'What is an ARIA snapshot and when is it better than many separate assertions?',
    outline: [
      'A YAML view of the accessibility tree: roles, names and structure, without styling.',
      '`toMatchAriaSnapshot` checks a whole region in one readable assertion and survives CSS changes.',
      'Good for menus, forms and lists; partial snapshots keep it from being brittle.',
      'The same tree is what `aiqa new page --url` builds page objects from.',
    ],
    files: [
      'packages/playwright-framework/tests/locators/aria-snapshot.spec.ts',
      'packages/cli/src/commands/new-page.ts',
    ],
  },

  // ── waiting ──────────────────────────────────────────────────────────────────────────────────
  {
    id: 'waiting-1',
    topic: 'waiting',
    level: 'core',
    question: 'What is auto-waiting, and what does Playwright check before a click?',
    outline: [
      'Actions wait for the element to be actionable: attached, visible, stable (not animating), enabled, and receiving events.',
      'So most explicit waits are unnecessary; the action already waits up to its timeout.',
      '`waitForTimeout` is a fixed sleep: slow when the page is fast, flaky when it is slow.',
    ],
    files: ['packages/playwright-framework/tests/features/auto-wait.spec.ts'],
    lab: '01-hard-wait',
  },
  {
    id: 'waiting-2',
    topic: 'waiting',
    level: 'core',
    question:
      'What is the difference between `expect(locator).toHaveText()` and `expect(await locator.textContent())`?',
    outline: [
      'The first is a web-first assertion: it retries until the text matches or the timeout ends.',
      'The second reads the text once, right now, and compares it; a value that arrives a moment later fails.',
      'Prefer web-first assertions for anything on the page; plain `expect` for values you already have.',
    ],
    files: ['packages/playwright-framework/tests/features/assertions.spec.ts'],
    lab: '01-hard-wait',
  },
  {
    id: 'waiting-3',
    topic: 'waiting',
    level: 'core',
    question: 'What happens if you forget `await` on a Playwright assertion?',
    outline: [
      'The assertion returns a promise that nobody waits for; the test moves on and may finish first.',
      'Recent Playwright fails the test with "Test ended", but inside helpers or promise chains it can pass silently.',
      'The `playwright/missing-playwright-await` lint rule catches it before the test runs.',
      'Make every new test fail once, for the reason you expect.',
    ],
    files: ['eslint.config.mjs'],
    lab: '04-missing-await',
  },
  {
    id: 'waiting-4',
    topic: 'waiting',
    level: 'senior',
    question: 'When are soft assertions and `expect.poll` the right tool?',
    outline: [
      'Soft assertions record a failure and carry on, so one run reports every wrong field on a form.',
      '`expect.poll` retries a function, for values that are not on the page: an API status, a database row, a queue.',
      '`toPass` retries a whole block when several steps must succeed together.',
    ],
    files: [
      'packages/playwright-framework/tests/features/assertions.spec.ts',
      'packages/data-framework/tests/flows/order-flow.spec.ts',
    ],
  },

  // ── network ──────────────────────────────────────────────────────────────────────────────────
  {
    id: 'network-1',
    topic: 'network',
    level: 'core',
    question: 'How do you mock an API response in a UI test, and what is the most common mistake?',
    outline: [
      '`page.route(pattern, route => route.fulfill({ json }))` answers matching requests yourself.',
      'The route must be registered before the action that sends the request, usually before `goto`.',
      'Mock only what the test is about; let the rest reach the real backend or a HAR.',
    ],
    files: ['packages/playwright-framework/tests/features/network-mocking.spec.ts'],
    lab: '06-late-route',
  },
  {
    id: 'network-2',
    topic: 'network',
    level: 'senior',
    question: 'What is a HAR file good for in testing?',
    outline: [
      'A recording of real traffic that `routeFromHAR` replays, so the page runs against a fixed backend.',
      'Useful for flaky or slow third parties and for reproducing a bug with the exact responses.',
      'It goes stale: re-record it on purpose, and do not let it hide a broken real API.',
    ],
    files: ['packages/playwright-framework/tests/features/har.spec.ts'],
  },
  {
    id: 'network-3',
    topic: 'network',
    level: 'senior',
    question: 'How do you test behaviour the network makes hard: offline, slow, a failing call, a WebSocket?',
    outline: [
      'Abort a route to simulate a failed call; delay a fulfil to simulate a slow one.',
      '`context.setOffline(true)` for offline; CDP network throttling for slow connections in Chromium.',
      'Wait on `page.waitForEvent("websocket")` and its frames, or `routeWebSocket` to stand in for the server.',
    ],
    files: [
      'packages/playwright-framework/tests/features/network-mocking.spec.ts',
      'packages/playwright-framework/tests/features/websocket.spec.ts',
      'packages/playwright-framework/src/perf/throttling.ts',
    ],
  },

  // ── api ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'api-1',
    topic: 'api',
    level: 'core',
    question: 'How do you write a chained API test, such as create, read, update and delete one booking?',
    outline: [
      'Each step takes what it needs from the previous response: the id from the create, the token from login.',
      'The test creates its own record; never read a fixed id that existed once.',
      'Check status, headers and the body against a schema, not only one field.',
      'Clean up what you made, or make data that cannot collide (unique names).',
    ],
    files: [
      'packages/api-framework/tests/restful-booker/booking-crud.spec.ts',
      'packages/api-framework/src/clients/booking.client.ts',
    ],
    lab: '07-api-chaining',
  },
  {
    id: 'api-2',
    topic: 'api',
    level: 'core',
    question: 'Why validate API responses against a schema, and how?',
    outline: [
      'A schema checks every field and type at once, so an extra, missing or renamed field fails the test.',
      'Here zod schemas parse the body; a failure names the exact path that is wrong.',
      'The same schema types the client, so tests and code cannot drift apart.',
    ],
    files: [
      'packages/api-framework/src/schemas/booking.schema.ts',
      'packages/api-framework/src/schemas/expect-schema.ts',
    ],
  },
  {
    id: 'api-3',
    topic: 'api',
    level: 'senior',
    question: 'How do you build request bodies for many test cases without copy-paste?',
    outline: [
      'A builder with valid defaults; each test overrides only the fields it is about.',
      'Seeded random data makes a failure reproducible from its seed.',
      'Negative cases change one field at a time, so the failure points at that field.',
    ],
    files: [
      'packages/api-framework/src/builders/booking.builder.ts',
      'packages/test-data-engine/src/builders.ts',
      'packages/test-data-engine/src/random.ts',
    ],
  },
  {
    id: 'api-4',
    topic: 'api',
    level: 'senior',
    question: 'How does testing a GraphQL or SOAP API differ from REST?',
    outline: [
      'GraphQL: one endpoint, errors often come back with status 200 in an `errors` array, so check it.',
      'Ask only for the fields under test; the response shape follows the query.',
      'SOAP: an XML envelope, faults instead of status codes; parse the XML, do not compare strings.',
    ],
    files: [
      'packages/api-framework/src/clients/graphql.client.ts',
      'packages/api-framework/tests/graphql/countries.spec.ts',
      'packages/api-framework/src/clients/soap.client.ts',
    ],
  },

  // ── data ─────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'data-1',
    topic: 'data',
    level: 'core',
    question:
      'An order is placed through the API. How do you prove it reached the database and the event stream?',
    outline: [
      'Place the order over HTTP, then poll Postgres for the row and read the Kafka topic for the event.',
      'Poll with a timeout (`expect.poll`), because the work is asynchronous; never sleep.',
      'Match on an id the test created, so other runs cannot confuse it.',
      'Also check the audit trail in MongoDB if the flow writes one.',
    ],
    files: [
      'packages/data-framework/tests/flows/order-flow.spec.ts',
      'packages/data-framework/src/bus.ts',
      'packages/data-framework/tests/mongodb/audit.spec.ts',
    ],
  },
  {
    id: 'data-2',
    topic: 'data',
    level: 'senior',
    question: 'What is a poison message, and how should a consumer handle one?',
    outline: [
      'A message the consumer can never process, such as invalid data; retrying it forever stops the partition behind it.',
      'Validate, then send it to a dead-letter topic with the reason, and commit the offset so the partition moves on.',
      'Test it: publish a bad message and assert both the dead letter and that the next good message is handled.',
    ],
    files: [
      'apps/order-service/src/main.ts',
      'apps/order-service/src/events.ts',
      'packages/data-framework/tests/flows/order-flow.spec.ts',
    ],
  },
  {
    id: 'data-3',
    topic: 'data',
    level: 'architect',
    question:
      'Two orders for the same product arrive at once. How do you keep stock correct, and how do you test it?',
    outline: [
      'Kafka partitions keep per-key order; one worker per partition gives parallelism across keys.',
      'Lock rows in a fixed order (by SKU) so two transactions cannot deadlock each other; retry a transaction Postgres aborts.',
      'Test with many concurrent orders against little stock and assert stock never goes negative.',
    ],
    files: [
      'docs/adr/0008-parallel-partitions-ordered-locks.md',
      'apps/order-service/src/partitions.ts',
      'packages/data-framework/tests/flows/concurrency.spec.ts',
    ],
  },
  {
    id: 'data-4',
    topic: 'data',
    level: 'senior',
    question: 'Why run the data stack with Docker Compose rather than Testcontainers here?',
    outline: [
      'One compose file serves every suite, the load tests, CI and a developer laptop alike.',
      'The stack starts once, not per test file, which is faster for a large suite.',
      'Trade-off: tests must not assume an empty database, so each test owns its data.',
    ],
    files: ['docs/adr/0005-docker-compose-not-testcontainers.md', 'infrastructure/docker/stack.compose.yml'],
  },

  // ── ai ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'ai-1',
    topic: 'ai',
    level: 'core',
    question: 'What is self-healing, and why does this framework refuse to edit test code itself?',
    outline: [
      'When a locator stops matching, the healer scores candidate elements by similarity to what it found before.',
      'A heal must match exactly one element above a threshold (0.75); otherwise it refuses.',
      'Default mode only suggests the new locator and the test still fails, so a real product change cannot hide behind a green run.',
      'Every heal and refusal is recorded; a person applies the fix.',
    ],
    files: [
      'docs/adr/0003-healing-never-rewrites-source.md',
      'packages/self-healing-engine/src/engine.ts',
      'packages/self-healing-engine/src/scoring.ts',
    ],
  },
  {
    id: 'ai-2',
    topic: 'ai',
    level: 'senior',
    question: 'How do you use an LLM in a test framework without making the tests non-deterministic?',
    outline: [
      'AI is off by default and every AI task has a non-AI fallback.',
      'The model only proposes; ordinary code checks the proposal (a locator must exist in the accessibility tree, data must pass its schema).',
      'The provider sits behind an interface, and a fake provider makes unit tests deterministic.',
      'Page content sent to a model is untrusted input: it may contain instructions.',
    ],
    files: [
      'docs/adr/0004-ai-optional-local-and-checked.md',
      'packages/ai-engine/src/provider.ts',
      'packages/ai-engine/src/providers/fake.ts',
      'packages/ai-engine/src/tasks/generate-locator.ts',
    ],
  },
  {
    id: 'ai-3',
    topic: 'ai',
    level: 'senior',
    question: 'How can AI help triage a failed run?',
    outline: [
      'Group failures by cause from the error, the step and the history: product bug, test bug, environment, flake.',
      'Draft a bug report with steps, expected and actual, and attach the trace.',
      'A person decides; the model output is a starting point, checked against the run data.',
    ],
    files: [
      'packages/ai-engine/src/tasks/failure-analysis.ts',
      'packages/ai-engine/src/tasks/bug-report.ts',
      'packages/reporting-engine/src/analysis.ts',
    ],
  },
  {
    id: 'ai-4',
    topic: 'ai',
    level: 'architect',
    question:
      "What are Playwright's test agents (planner, generator, healer) and how would you adopt them safely?",
    outline: [
      'The planner explores the app and writes a test plan; the generator turns the plan into specs; the healer runs failing specs and proposes fixes.',
      'They drive a real browser through the Playwright MCP server, seeded from a seed spec.',
      "Treat their output like a colleague's pull request: reviewed, run in CI, and held to the same lint rules.",
    ],
    files: [
      'packages/playwright-framework/.claude/agents/playwright-test-planner.md',
      'packages/playwright-framework/.claude/agents/playwright-test-generator.md',
      'packages/playwright-framework/.claude/agents/playwright-test-healer.md',
      'packages/playwright-framework/tests/seed.spec.ts',
    ],
  },

  // ── performance ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'performance-1',
    topic: 'performance',
    level: 'core',
    question: 'What are Core Web Vitals, and how do you measure them in a Playwright test?',
    outline: [
      'LCP (loading), INP (responsiveness) and CLS (layout stability), with "good" thresholds from Google.',
      'Read them in the page with PerformanceObserver (or the web-vitals library) and return them to the test.',
      'Run with one worker and no retries, because parallel load distorts the numbers.',
    ],
    files: [
      'packages/playwright-framework/src/perf/vitals.ts',
      'packages/playwright-framework/tests/performance/web-vitals.spec.ts',
    ],
  },
  {
    id: 'performance-2',
    topic: 'performance',
    level: 'senior',
    question: 'A performance number is noisy from run to run. How do you turn it into a useful gate?',
    outline: [
      "Record every run and compare against the metric's usual level, not a single fixed number.",
      'Flag a regression only when it is clearly outside normal variation.',
      'Fixed budgets still apply for hard limits, such as page weight.',
    ],
    files: [
      'packages/reporting-engine/src/analysis.ts',
      'packages/cli/src/commands/history.ts',
      'packages/playwright-framework/tests/performance/page-weight.spec.ts',
    ],
  },
  {
    id: 'performance-3',
    topic: 'performance',
    level: 'senior',
    question: 'How is load testing with k6 different from a Playwright performance test?',
    outline: [
      "Playwright measures one user's experience in a real browser; k6 sends many concurrent requests to the service.",
      'k6 checks throughput, latency percentiles and error rate under load against thresholds.',
      'Load only your own environment, never a public demo site.',
    ],
    files: ['packages/load-tests/scripts/order-flow.js', 'packages/load-tests/src/run.ts'],
  },

  // ── contracts ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'contracts-1',
    topic: 'contracts',
    level: 'core',
    question: 'What is consumer-driven contract testing, and what problem does it solve?',
    outline: [
      'Each consumer records the requests it makes and the parts of the response it relies on (a pact).',
      "The provider replays the pacts against itself, so a change that breaks a consumer fails the provider's build.",
      'It replaces slow end-to-end environments for "does A still work with B".',
    ],
    files: [
      'packages/contract-tests/tests/consumer/storefront.pact.test.ts',
      'packages/contract-tests/tests/provider/order-service.verify.test.ts',
      'docs/adr/0011-contracts-openapi-and-pact.md',
    ],
  },
  {
    id: 'contracts-2',
    topic: 'contracts',
    level: 'senior',
    question: 'How do you contract-test asynchronous messages, such as Kafka events?',
    outline: [
      'A message pact: the consumer states the event shape it can handle.',
      'The provider check builds the message with the same code it publishes with, and Pact compares.',
      'Keep matchers loose on values and strict on shape.',
    ],
    files: [
      'packages/contract-tests/tests/consumer/notifications.pact.test.ts',
      'apps/order-service/src/events.ts',
    ],
  },
  {
    id: 'contracts-3',
    topic: 'contracts',
    level: 'senior',
    question: 'How do you keep an OpenAPI document honest?',
    outline: [
      'Generate it from the schemas the service validates with, so it cannot drift from the code.',
      'Validate the document itself as OpenAPI 3.1 in a unit test.',
      'Check real responses against it in an integration test, and prove the checker can fail.',
    ],
    files: [
      'apps/order-service/src/api.ts',
      'packages/data-framework/src/openapi.ts',
      'packages/data-framework/tests/http/openapi.spec.ts',
    ],
  },

  // ── security ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'security-1',
    topic: 'security',
    level: 'core',
    question: 'What should a service check before it trusts a JWT bearer token?',
    outline: [
      'The signature, against a key it already trusts (JWKS), with the algorithm pinned by the server.',
      'Then issuer, audience, expiry, and the role or scope the operation needs.',
      'Decoding is not verifying: never trust claims you have not checked the signature of.',
      "Tests: tampered claims, `alg: none`, a stranger's key, the wrong audience, an expired token.",
    ],
    files: ['apps/order-service/src/auth.ts', 'apps/order-service/tests/auth.test.ts'],
    lab: '08-jwt-trust',
  },
  {
    id: 'security-2',
    topic: 'security',
    level: 'senior',
    question: 'What is the difference between 401 and 403, and how do you test both?',
    outline: [
      '401: no valid credentials. A missing token gets a bare `WWW-Authenticate` challenge; a bad one gets `invalid_token`.',
      '403: valid credentials, not allowed. A token without the role gets `insufficient_scope`.',
      'Test each with a real token from the identity provider, plus a short-lived token for expiry.',
    ],
    files: [
      'docs/adr/0012-oauth-keycloak-for-product-writes.md',
      'packages/data-framework/tests/http/auth.spec.ts',
    ],
  },
  {
    id: 'security-3',
    topic: 'security',
    level: 'senior',
    question: 'What security checks belong in CI, and which ones should fail the build?',
    outline: [
      'Dependencies: known vulnerabilities (pnpm audit, OSV-Scanner) and licences outside an allow-list.',
      'Accepted findings are listed with a reason and an expiry date, after which they fail again.',
      'DAST: a ZAP API scan of your own service; injection-class rules fail, the rest is reported.',
      'Scanners found real bugs here: an integer overflow and a NUL byte that caused 500s.',
    ],
    files: [
      'docs/adr/0013-security-gates-in-ci.md',
      'osv-scanner.toml',
      'scripts/check-licences.mjs',
      'infrastructure/security/zap-rules.tsv',
    ],
  },
  {
    id: 'security-4',
    topic: 'security',
    level: 'core',
    question: 'Which input-validation tests would you add to any API?',
    outline: [
      'Boundaries: the largest and smallest allowed values, and one past each (an integer column has a maximum).',
      'Control characters and very long strings in text fields.',
      'A malformed body, a wrong content type, unknown fields.',
      'Expect a 400 with a clear message, never a 500 that leaks the internal error.',
    ],
    files: ['apps/order-service/src/contract.ts', 'packages/data-framework/tests/http/limits.spec.ts'],
  },

  // ── platform ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'platform-1',
    topic: 'platform',
    level: 'core',
    question: 'How do you make a large Playwright suite fast in CI?',
    outline: [
      'Run tests in parallel within files (`fullyParallel`) and across machines with `--shard`.',
      "Merge the shards' blob reports into one HTML report afterwards.",
      'Cache dependencies and browsers; install only the browsers a job needs.',
      'Retries in CI only, with a trace on first retry, so flakes are visible, not hidden.',
    ],
    files: [
      '.github/workflows/ci.yml',
      'packages/playwright-framework/merge.config.ts',
      '.github/actions/setup/action.yml',
    ],
  },
  {
    id: 'platform-2',
    topic: 'platform',
    level: 'senior',
    question: 'How do you find and track flaky tests over time?',
    outline: [
      'Record every run, including retries, in a history store.',
      'A test that passed only on retry, or flips between runs, is flaky; list them with `aiqa flaky`.',
      'Fix or quarantine with a ticket; never raise retries to make the problem go away.',
    ],
    files: [
      'packages/reporting-engine/src/playwright-reporter.ts',
      'docs/adr/0006-run-history-sqlite-with-json-fallback.md',
      'packages/cli/src/commands/history.ts',
    ],
  },
  {
    id: 'platform-3',
    topic: 'platform',
    level: 'architect',
    question: 'How would you run test suites inside Kubernetes, and why bother?',
    outline: [
      'Each suite is a Job rendered from the same Helm chart as the stack, so tests run next to the services.',
      'UI Jobs connect to a shared Playwright server instead of each carrying a browser.',
      'Reports come back through a mount; metrics go to Prometheus through a Pushgateway.',
      'It proves the tests work in the environment the service really runs in.',
    ],
    files: [
      'docs/adr/0009-kind-helm-and-test-jobs.md',
      'infrastructure/kubernetes/aiqa-stack/templates/jobs/ui.yaml',
      'infrastructure/kubernetes/aiqa-stack/templates/playwright-server.yaml',
      'scripts/k8s.mjs',
    ],
  },
  {
    id: 'platform-4',
    topic: 'platform',
    level: 'senior',
    question: 'What observability would you give a test platform?',
    outline: [
      'Test results as metrics (pass, fail, flaky, duration per suite) on a dashboard, pushed at the end of each run.',
      'The service under test exposes metrics, logs and traces, so a failing test can be followed into the service.',
      'Reporting must never fail a run: short timeouts, errors logged and ignored.',
    ],
    files: [
      'docs/adr/0010-test-metrics-through-pushgateway.md',
      'packages/reporting-engine/src/push.ts',
      'apps/order-service/src/tracing.ts',
      'infrastructure/kubernetes/aiqa-stack/files/grafana/dashboards/test-runs.json',
    ],
  },
];
