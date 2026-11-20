import type { EvalCase } from '../eval';
import type { PastOutcome, TriageContext, TriageLabel } from './context';

/**
 * Thirty labelled failures for the Triage agent's eval. Each mirrors a failure this repository's
 * suites have produced or can produce (UI, API, data and messaging), with the label a QA engineer
 * would give after reading the trace. Labels are a person's judgement: review them, and change a
 * label rather than the agent when you disagree.
 */

const ok = (n: number): PastOutcome[] => Array.from({ length: n }, () => ({ outcome: 'passed' }));
const seq = (...outcomes: ('p' | 'f')[]): PastOutcome[] =>
  outcomes.map((o) => (o === 'p' ? { outcome: 'passed' } : { outcome: 'failed', error: 'see this run' }));

interface Shape {
  title: string;
  file: string;
  project?: string;
  error: string;
  attempts?: TriageContext['attempts'];
  previous?: PastOutcome[];
  failing?: number;
  total?: number;
  sameError?: number;
  otherFailures?: TriageContext['otherFailures'];
}

function failure(
  id: string,
  expected: TriageLabel,
  note: string,
  s: Shape,
): EvalCase<TriageContext, TriageLabel> {
  return {
    id,
    expected,
    note,
    input: {
      testId: id,
      title: s.title,
      file: s.file,
      project: s.project ?? 'chromium',
      errorMessage: s.error,
      attempts: s.attempts ?? ['failed'],
      previous: s.previous ?? ok(6),
      run: {
        id: 'eval',
        suite: s.file.includes('api') ? 'api' : s.file.includes('data') ? 'data' : 'ui',
        failing: s.failing ?? 1,
        total: s.total ?? 40,
        sameError: s.sameError ?? 0,
      },
      otherFailures: s.otherFailures ?? [],
    },
  };
}

export const TRIAGE_CASES: readonly EvalCase<TriageContext, TriageLabel>[] = [
  failure('retry-pass-click', 'flaky', 'Passed on the retry with no change.', {
    title: 'checkout › completes an order',
    file: 'journeys/checkout.spec.ts',
    error:
      "locator.click: Timeout 10000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Finish' })",
    attempts: ['failed', 'passed'],
  }),
  failure('connection-refused', 'environment', 'The site did not answer at all.', {
    title: 'login › standard user reaches the inventory',
    file: 'journeys/login.spec.ts',
    error: 'page.goto: net::ERR_CONNECTION_REFUSED at https://www.saucedemo.com/',
  }),
  failure('api-503', 'environment', 'Heroku dyno asleep or down.', {
    title: 'booking › creates a booking',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error: 'Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 503\n\nService Unavailable',
  }),
  failure('checkout-button-gone', 'test', 'The button was renamed; the locator is stale.', {
    title: 'checkout › reaches the overview page',
    file: 'journeys/checkout.spec.ts',
    error:
      "locator.click: Timeout 10000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Checkout' })",
  }),
  failure('confirmation-text', 'product', 'The page shows the wrong confirmation.', {
    title: 'checkout › shows the order confirmation',
    file: 'journeys/checkout.spec.ts',
    error:
      'Error: expect(locator).toHaveText(expected) failed\n\nExpected: "Thank you for your order!"\nReceived: "Checkout: Complete!"',
  }),
  failure('strict-mode', 'test', 'The locator matches two buttons.', {
    title: 'inventory › adds the backpack',
    file: 'journeys/checkout.spec.ts',
    error:
      "Error: strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 6 elements",
  }),
  failure('orders-500', 'product', 'The service returns 500 for a valid order.', {
    title: 'orders API › accepts a valid order',
    file: 'data-framework/tests/http/orders-api.spec.ts',
    error: 'Error: expect(received).toBe(expected)\n\nExpected: 202\nReceived: 500',
  }),
  failure('mass-goto-timeout', 'environment', 'A third of the suite timed out on navigation together.', {
    title: 'inventory › sorts by price',
    file: 'journeys/inventory.spec.ts',
    error: 'Test timeout of 30000ms exceeded.\nwhile running page.goto("https://www.saucedemo.com/")',
    failing: 13,
    total: 40,
    sameError: 12,
  }),
  failure('history-flips', 'flaky', 'Green and red with no code change between runs.', {
    title: 'dynamic loading › shows the text after the spinner',
    file: 'features/auto-wait.spec.ts',
    error:
      "Error: Timed out 5000ms waiting for expect(locator).toBeVisible()\n\nLocator: getByText('Hello World!')",
    previous: seq('p', 'f', 'p', 'f', 'p'),
  }),
  failure('typeerror-in-client', 'test', 'A bug in the test helper, not in the API.', {
    title: 'booking › reads back a created booking',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error:
      "TypeError: Cannot read properties of undefined (reading 'bookingid')\n    at BookingClient.create (src/clients/booking.client.ts:41:22)",
  }),
  failure('schema-field-missing', 'product', 'The API dropped a field the contract promises.', {
    title: 'booking › response matches the schema',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error:
      'Error: expect(received).toEqual(expected)\n\nExpected: ObjectContaining {"bookingid": Any<Number>}\nReceived: {"booking": {...}}',
  }),
  failure('dns', 'environment', 'Name lookup failed on the runner.', {
    title: 'auth › gets a token',
    file: 'api-framework/tests/restful-booker/auth.spec.ts',
    error: 'apiRequestContext.post: getaddrinfo ENOTFOUND restful-booker.herokuapp.com',
  }),
  failure('browser-missing', 'environment', 'Browsers not installed on the machine.', {
    title: 'smoke › login page loads',
    file: 'smoke/saucedemo.smoke.spec.ts',
    project: 'webkit',
    error:
      "browserType.launch: Executable doesn't exist at /ms-playwright/webkit-2272/pw_run.sh\nLooks like Playwright was just installed or updated.",
    failing: 4,
    total: 40,
    sameError: 3,
  }),
  failure('target-closed', 'test', 'The test did not await an action before the page closed.', {
    title: 'cart › removes an item',
    file: 'journeys/checkout.spec.ts',
    error: 'Error: page.fill: Target page, context or browser has been closed',
  }),
  failure('visual-diff', 'product', 'The login form layout changed.', {
    title: 'login form looks the same',
    file: 'visual/login.visual.spec.ts',
    error:
      'Error: expect(page).toHaveScreenshot(expected) failed\n\n  1250 pixels (ratio 0.02 of all image pixels) are different.',
  }),
  failure('flips-visible', 'flaky', 'Passes and fails on alternate runs.', {
    title: 'login › shows the lock-out error',
    file: 'journeys/login.spec.ts',
    error:
      "Error: Timed out 5000ms waiting for expect(locator).toBeVisible()\n\nLocator: getByTestId('error')",
    previous: seq('p', 'p', 'f', 'p'),
  }),
  failure('econnreset', 'environment', 'The connection dropped mid-request.', {
    title: 'booking › patches the first name',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error: 'apiRequestContext.patch: read ECONNRESET',
  }),
  failure('item-count', 'product', 'One product disappeared from the catalogue.', {
    title: 'inventory › lists six products',
    file: 'journeys/inventory.spec.ts',
    error:
      "Error: expect(locator).toHaveCount(expected) failed\n\nLocator: getByTestId('inventory-item')\nExpected: 6\nReceived: 5",
  }),
  failure('html-instead-of-json', 'environment', 'A proxy or maintenance page answered instead of the API.', {
    title: 'graphql › lists countries',
    file: 'api-framework/tests/graphql/countries.spec.ts',
    error: 'SyntaxError: Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON\n    at APIResponse.json',
  }),
  failure('zod-type-change', 'product', 'The API now sends the price as a string.', {
    title: 'booking › response matches the schema',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error:
      'ZodError: [\n  {\n    "expected": "number",\n    "code": "invalid_type",\n    "path": ["totalprice"],\n    "message": "Invalid input: expected number, received string"\n  }\n]',
  }),
  failure(
    'outside-viewport',
    'test',
    'The mobile test clicks without scrolling a fixed footer out of the way.',
    {
      title: 'checkout › completes an order on a phone',
      file: 'journeys/checkout.spec.ts',
      project: 'mobile-safari',
      error:
        'locator.click: Element is outside of the viewport\nCall log:\n  - attempting click action\n  - element is outside of the viewport',
    },
  ),
  failure('login-disabled', 'product', 'The login button stays disabled with valid input.', {
    title: 'login › enables the button when both fields are filled',
    file: 'journeys/login.spec.ts',
    error:
      "Error: expect(locator).toBeEnabled() failed\n\nLocator: getByRole('button', { name: 'Login' })\nExpected: enabled\nReceived: disabled",
  }),
  failure(
    'consumer-down',
    'environment',
    'Half the data suite polled for events that never came: the consumer was down.',
    {
      title: 'order flow › confirms an order in stock',
      file: 'data-framework/tests/flows/order-flow.spec.ts',
      error:
        'Error: expect(received).toBe(expected)\n\nExpected: 1\nReceived: 0\n\nCall Log:\n- Timeout 10000ms exceeded while waiting on the predicate',
      failing: 6,
      total: 12,
      sameError: 5,
    },
  ),
  failure('postgres-refused', 'environment', 'The database container was not running.', {
    title: 'schema › orders table has the expected columns',
    file: 'data-framework/tests/postgres/schema.spec.ts',
    error: 'Error: connect ECONNREFUSED 127.0.0.1:5432',
  }),
  failure('bad-regex', 'test', 'A typo in the spec itself.', {
    title: 'inventory › filters by name',
    file: 'journeys/inventory.spec.ts',
    error:
      'SyntaxError: Invalid regular expression: /Sauce Labs (Back/: Unterminated group\n    at journeys/inventory.spec.ts:18:31',
  }),
  failure(
    'keycloak-401s',
    'environment',
    'Every authenticated call got 401 at once: the identity provider was not ready.',
    {
      title: 'products API › catalog admin can update a product',
      file: 'data-framework/tests/http/auth.spec.ts',
      error: 'Error: expect(received).toBe(expected)\n\nExpected: 200\nReceived: 401',
      failing: 5,
      total: 14,
      sameError: 4,
    },
  ),
  failure('retry-pass-url', 'flaky', 'Passed on retry.', {
    title: 'login › standard user reaches the inventory',
    file: 'journeys/login.spec.ts',
    error:
      'Error: expect(page).toHaveURL(expected) failed\n\nExpected pattern: /inventory\\.html/\nReceived string: "https://www.saucedemo.com/"',
    attempts: ['failed', 'failed', 'passed'],
  }),
  failure('sort-order', 'product', 'Sorting by name Z to A returns the wrong first item.', {
    title: 'inventory › sorts by name, Z to A',
    file: 'journeys/inventory.spec.ts',
    error:
      'Error: expect(locator).toHaveText(expected) failed\n\nExpected: "Test.allTheThings() T-Shirt (Red)"\nReceived: "Sauce Labs Backpack"',
  }),
  failure('cloudflare-wall', 'environment', 'A bot check page replaced the site for every test.', {
    title: 'login › standard user reaches the inventory',
    file: 'journeys/login.spec.ts',
    error:
      "locator.fill: Timeout 10000ms exceeded.\nCall log:\n  - waiting for getByPlaceholder('Username')\n  - page title: Just a moment...",
    failing: 9,
    total: 40,
    sameError: 8,
  }),
  failure('shared-data-count', 'flaky', 'Counts bookings other runs create too; depends on timing.', {
    title: 'booking › finds the bookings it created by name',
    file: 'api-framework/tests/restful-booker/booking-crud.spec.ts',
    error: 'Error: expect(received).toBe(expected)\n\nExpected: 3\nReceived: 2',
    previous: seq('f', 'p', 'f', 'p'),
  }),
];
