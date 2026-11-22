import type { A11yFinding, A11yPriority } from '../a11y/agent';
import type { FlakyCause, FlakyEvidence } from '../flaky/agent';
import type { RunFacts } from '../reporter/agent';
import type { HealEvent } from '@aiqa/self-healing-engine';

/**
 * Labelled cases for the agents' evals. Labels are a QA engineer's judgement: review them, and
 * change a label rather than an agent when you disagree.
 */

export const FLAKY_CASES: { id: string; input: FlakyEvidence; expected: FlakyCause }[] = [
  {
    id: 'spinner-wait',
    expected: 'timing',
    input: {
      testId: 'f1',
      title: 'dynamic loading › shows the text after the spinner',
      file: 'features/auto-wait.spec.ts',
      errors: [
        "Error: Timed out 5000ms waiting for expect(locator).toBeVisible()  Locator: getByText('Hello World!')",
      ],
    },
  },
  {
    id: 'booking-count',
    expected: 'shared-data',
    input: {
      testId: 'f2',
      title: 'booking › finds the bookings it created by name',
      file: 'restful-booker/booking-crud.spec.ts',
      errors: [
        'Error: expect(received).toBe(expected)  Expected: 3  Received: 4',
        'Error: expect(received).toBe(expected)  Expected: 3  Received: 5',
      ],
    },
  },
  {
    id: 'heroku-sleep',
    expected: 'external-service',
    input: {
      testId: 'f3',
      title: 'auth › gets a token',
      file: 'restful-booker/auth.spec.ts',
      errors: [
        'apiRequestContext.post: read ECONNRESET',
        'Error: expect(received).toBe(expected)  Expected: 200  Received: 503',
      ],
    },
  },
  {
    id: 'uses-previous-cart',
    expected: 'test-order',
    input: {
      testId: 'f4',
      title: 'checkout › reviews the item added in the previous test',
      file: 'journeys/checkout.spec.ts',
      errors: [
        "Error: expect(locator).toHaveText(expected) failed  Expected: '1'  Received: ''  Locator: getByTestId('shopping-cart-badge')",
      ],
    },
  },
  {
    id: 'animation-click',
    expected: 'timing',
    input: {
      testId: 'f5',
      title: 'menu › opens the side menu and logs out',
      file: 'journeys/login.spec.ts',
      errors: [
        'locator.click: Element is not stable - waiting for element to stop animating',
        "locator.click: Timeout 10000ms exceeded. waiting for getByRole('link', { name: 'Logout' })",
      ],
    },
  },
  {
    id: 'duplicate-sku',
    expected: 'shared-data',
    input: {
      testId: 'f6',
      title: 'products API › creates a product',
      file: 'data-framework/tests/http/orders-api.spec.ts',
      errors: [
        'Error: expect(received).toBe(expected)  Expected: 201  Received: 200 (the SKU already exists: another run created it)',
      ],
    },
  },
  {
    id: 'geo-api',
    expected: 'external-service',
    input: {
      testId: 'f7',
      title: 'graphql › lists countries',
      file: 'graphql/countries.spec.ts',
      errors: ['apiRequestContext.post: connect ETIMEDOUT 104.21.80.1:443'],
    },
  },
  {
    id: 'login-state-left',
    expected: 'test-order',
    input: {
      testId: 'f8',
      title: 'login › shows the login form',
      file: 'journeys/login.spec.ts',
      errors: [
        "Error: expect(locator).toBeVisible() failed  Locator: getByRole('button', { name: 'Login' })  Expected: visible  Received: <element(s) not found>  Page URL at failure: https://www.saucedemo.com/inventory.html (passes when run alone)",
      ],
    },
  },
];

export const A11Y_CASES: { finding: A11yFinding; expected: A11yPriority }[] = [
  {
    expected: 'fix-now',
    finding: {
      id: 'button-name',
      impact: 'critical',
      help: 'Buttons must have discernible text',
      nodes: 3,
      page: 'inventory',
    },
  },
  {
    expected: 'fix-now',
    finding: {
      id: 'label',
      impact: 'critical',
      help: 'Form elements must have labels',
      nodes: 2,
      page: 'checkout step one',
    },
  },
  {
    expected: 'fix-now',
    finding: {
      id: 'image-alt',
      impact: 'critical',
      help: 'Images must have alternative text',
      nodes: 6,
      page: 'inventory',
    },
  },
  {
    expected: 'fix-now',
    finding: {
      id: 'meta-viewport',
      impact: 'critical',
      help: 'Zooming and scaling must not be disabled',
      nodes: 1,
      page: 'all pages',
    },
  },
  {
    expected: 'fix-now',
    finding: {
      id: 'link-name',
      impact: 'serious',
      help: 'Links must have discernible text',
      nodes: 4,
      page: 'footer',
    },
  },
  {
    expected: 'fix-soon',
    finding: {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      nodes: 2,
      page: 'footer',
    },
  },
  {
    expected: 'fix-soon',
    finding: {
      id: 'html-has-lang',
      impact: 'serious',
      help: '<html> element must have a lang attribute',
      nodes: 1,
      page: 'all pages',
    },
  },
  {
    expected: 'later',
    finding: {
      id: 'region',
      impact: 'moderate',
      help: 'All page content should be contained by landmarks',
      nodes: 5,
      page: 'login',
    },
  },
  {
    expected: 'later',
    finding: {
      id: 'heading-order',
      impact: 'moderate',
      help: 'Heading levels should only increase by one',
      nodes: 1,
      page: 'cart',
    },
  },
  {
    expected: 'later',
    finding: {
      id: 'landmark-one-main',
      impact: 'moderate',
      help: 'Document should have one main landmark',
      nodes: 1,
      page: 'login',
    },
  },
];

const facts = (over: Partial<RunFacts>): RunFacts => ({
  suite: 'ui',
  runId: 'run-eval',
  startedAt: '2026-11-20T09:30:00.000Z',
  durationMinutes: 6.4,
  total: 48,
  passed: 48,
  failed: 0,
  flaky: 0,
  skipped: 2,
  passRate: 100,
  failures: [],
  flakyTests: [],
  regressions: [],
  ...over,
});

export const REPORTER_CASES: { id: string; facts: RunFacts }[] = [
  { id: 'all-green', facts: facts({ passRateChange: 0 }) },
  {
    id: 'one-product-bug',
    facts: facts({
      passed: 46,
      failed: 1,
      flaky: 1,
      passRate: 97.9,
      passRateChange: -2.1,
      failures: [
        { title: 'inventory › lists six products', error: 'Expected: 6 Received: 5', label: 'product' },
      ],
      flakyTests: ['login › shows the lock-out error'],
    }),
  },
  {
    id: 'site-down',
    facts: facts({
      total: 40,
      passed: 27,
      failed: 13,
      passRate: 67.5,
      passRateChange: -32.5,
      failures: Array.from({ length: 3 }, (_, i) => ({
        title: `journey ${i + 1} › reaches the inventory`,
        error: 'page.goto: net::ERR_CONNECTION_REFUSED',
        label: 'environment',
      })),
    }),
  },
  {
    id: 'slower',
    facts: facts({
      suite: 'perf',
      total: 6,
      passed: 6,
      skipped: 0,
      passRate: 100,
      regressions: [
        { title: 'inventory page', metric: 'lcp_ms', latest: 2400, baseline: 1600, changePct: 50 },
      ],
    }),
  },
  {
    id: 'api-first-run',
    facts: facts({
      suite: 'api',
      total: 22,
      passed: 21,
      failed: 1,
      skipped: 0,
      passRate: 95.5,
      failures: [
        {
          title: 'booking › response matches the schema',
          error: 'ZodError: totalprice expected number, received string',
          label: 'product',
        },
      ],
    }),
  },
];

export const HEAL_CASES: HealEvent[] = [
  {
    locatorKey: 'LoginPage.loginButton',
    testId: 'h1',
    failedSelector: "locator('#login-button')",
    suggestion: "page.getByRole('button', { name: 'Login' })",
    strategy: 'role',
    score: 0.94,
    outcome: 'healed',
    createdAt: '2026-11-20T00:00:00Z',
  },
  {
    locatorKey: 'InventoryPage.sortSelect',
    testId: 'h2',
    failedSelector: "locator('.product_sort_container')",
    suggestion: "page.getByTestId('product-sort-container')",
    strategy: 'test-id',
    score: 0.88,
    outcome: 'healed',
    createdAt: '2026-11-20T00:00:00Z',
  },
  {
    locatorKey: 'CheckoutPage.postcode',
    testId: 'h3',
    failedSelector: "locator('#postal-code')",
    suggestion: "page.getByPlaceholder('Zip/Postal Code')",
    strategy: 'placeholder',
    score: 0.81,
    outcome: 'healed',
    createdAt: '2026-11-20T00:00:00Z',
  },
];

/** Accessibility trees captured from SauceDemo, for the planner's eval (no browser needed). */
export const PLANNER_SNAPSHOTS: { id: string; url: string; snapshot: string }[] = [
  {
    id: 'login',
    url: 'https://www.saucedemo.com/',
    snapshot: `- text: Swag Labs
- textbox "Username"
- textbox "Password"
- button "Login"
- heading "Accepted usernames are:" [level=4]
- text: standard_user locked_out_user problem_user performance_glitch_user error_user visual_user
- heading "Password for all users:" [level=4]
- text: secret_sauce`,
  },
  {
    id: 'inventory',
    url: 'https://www.saucedemo.com/inventory.html',
    snapshot: `- button "Open Menu"
- text: Swag Labs Products
- combobox:
  - option "Name (A to Z)" [selected]
  - option "Name (Z to A)"
  - option "Price (low to high)"
  - option "Price (high to low)"
- link "Sauce Labs Backpack"
- text: $29.99
- button "Add to cart"
- link "Sauce Labs Bike Light"
- text: $9.99
- button "Add to cart"
- link "Sauce Labs Bolt T-Shirt"
- text: $15.99
- button "Add to cart"
- contentinfo:
  - link "Twitter"
  - link "Facebook"
  - link "LinkedIn"
  - text: © 2026 Sauce Labs. All Rights Reserved.`,
  },
];
