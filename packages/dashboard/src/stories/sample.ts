import type { AgentRunRow, FlakyRow, HealRow, NavItem, RunRow, TestRow, TrendPoint } from '../types';

/** Fixed sample data for stories: the same every render, so screenshots stay stable. */
export const NAV: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/trends', label: 'Trends' },
  { href: '/flaky', label: 'Flaky tests' },
  { href: '/heals', label: 'Heal audit' },
  { href: '/agents', label: 'Agent runs' },
];

export const RUNS: RunRow[] = [
  {
    id: 'r5',
    suite: 'ui',
    startedAt: '2026-11-22T09:30:00Z',
    environment: 'chromium',
    passed: 118,
    failed: 2,
    flaky: 1,
    skipped: 3,
    durationMs: 412_000,
  },
  {
    id: 'r4',
    suite: 'api',
    startedAt: '2026-11-22T09:10:00Z',
    environment: 'local',
    passed: 64,
    failed: 0,
    flaky: 0,
    skipped: 0,
    durationMs: 38_500,
  },
  {
    id: 'r3',
    suite: 'ui',
    startedAt: '2026-11-21T21:00:00Z',
    environment: 'chromium',
    passed: 119,
    failed: 0,
    flaky: 2,
    skipped: 3,
    durationMs: 398_000,
  },
  {
    id: 'r2',
    suite: 'data',
    startedAt: '2026-11-21T18:45:00Z',
    environment: 'stack',
    passed: 41,
    failed: 0,
    flaky: 0,
    skipped: 1,
    durationMs: 96_200,
  },
  {
    id: 'r1',
    suite: 'ui',
    startedAt: '2026-11-21T09:00:00Z',
    environment: 'chromium',
    passed: 121,
    failed: 0,
    flaky: 0,
    skipped: 3,
    durationMs: 405_300,
  },
];

export const TESTS: TestRow[] = [
  {
    id: 't1',
    title: 'checkout › completes an order with two items',
    file: 'tests/e2e/checkout.spec.ts',
    project: 'chromium',
    status: 'failed',
    durationMs: 8_400,
    retries: 1,
    error:
      'Error: expect(locator).toHaveText(expected)\nExpected: "Thank you for your order!"\nReceived: "Checkout: Overview"',
  },
  {
    id: 't2',
    title: 'inventory › sorts by price, low to high',
    file: 'tests/e2e/inventory.spec.ts',
    project: 'chromium',
    status: 'flaky',
    durationMs: 3_100,
    retries: 1,
  },
  {
    id: 't3',
    title: 'login › rejects a locked-out user',
    file: 'tests/e2e/login.spec.ts',
    project: 'chromium',
    status: 'passed',
    durationMs: 1_250,
    retries: 0,
  },
  {
    id: 't4',
    title: 'login › signs in a standard user',
    file: 'tests/e2e/login.spec.ts',
    project: 'chromium',
    status: 'passed',
    durationMs: 1_180,
    retries: 0,
  },
  {
    id: 't5',
    title: 'cart › keeps items after reload',
    file: 'tests/e2e/cart.spec.ts',
    project: 'chromium',
    status: 'skipped',
    durationMs: 0,
    retries: 0,
  },
];

export const PASS_RATE: TrendPoint[] = [
  { label: '13 Nov', value: 97.5 },
  { label: '14 Nov', value: 98.3 },
  { label: '15 Nov', value: 96.7 },
  { label: '16 Nov', value: 99.2 },
  { label: '17 Nov', value: 99.2 },
  { label: '18 Nov', value: 95.8 },
  { label: '19 Nov', value: 98.3 },
  { label: '20 Nov', value: 100 },
  { label: '21 Nov', value: 98.4 },
  { label: '22 Nov', value: 97.5 },
];

export const DURATION: TrendPoint[] = PASS_RATE.map((p, i) => ({
  label: p.label,
  value: [402, 398, 415, 409, 401, 430, 396, 405, 398, 412][i]!,
}));

export const FLAKY: FlakyRow[] = [
  {
    testId: 'f1',
    title: 'inventory › sorts by price, low to high',
    file: 'tests/e2e/inventory.spec.ts',
    flakyRuns: 3,
    runs: 10,
    lastSeen: '2026-11-22T09:30:00Z',
  },
  {
    testId: 'f2',
    title: 'cart › badge shows the item count',
    file: 'tests/e2e/cart.spec.ts',
    flakyRuns: 1,
    runs: 10,
    lastSeen: '2026-11-19T09:00:00Z',
  },
];

export const HEALS: HealRow[] = [
  {
    id: 'h1',
    locatorKey: 'CheckoutPage.payNow',
    original: "getByTestId('pay-now')",
    healed: "getByRole('button', { name: 'Pay now' })",
    score: 0.91,
    outcome: 'healed',
    at: '2026-11-22T09:31:10Z',
    suggestion: 'Patch proposed for pages/checkout.page.ts',
  },
  {
    id: 'h2',
    locatorKey: 'InventoryPage.firstProduct',
    original: '#item_4_title_link',
    healed: "getByRole('link', { name: 'Sauce Labs Backpack' })",
    score: 0.78,
    outcome: 'suggested',
    at: '2026-11-21T21:04:00Z',
  },
  {
    id: 'h3',
    locatorKey: 'MenuPage.logout',
    original: '#logout_sidebar_link',
    healed: '',
    score: 0.42,
    outcome: 'rejected',
    at: '2026-11-20T10:15:00Z',
  },
];

export const AGENT_RUNS: AgentRunRow[] = [
  {
    id: 'a1',
    agent: 'triage',
    model: 'ollama:qwen2.5-coder:7b',
    source: 'model',
    startedAt: '2026-11-22T10:02:00Z',
    durationMs: 152_000,
    toolCalls: 3,
  },
  {
    id: 'a2',
    agent: 'api-tester',
    model: 'ollama:qwen2.5-coder:7b',
    source: 'rules',
    startedAt: '2026-11-22T08:35:00Z',
    durationMs: 900_000,
    toolCalls: 0,
    fallbackReason: 'model failed: The operation was aborted due to timeout',
  },
  {
    id: 'a3',
    agent: 'run-reporter',
    model: 'off',
    source: 'rules',
    startedAt: '2026-11-21T19:00:00Z',
    durationMs: 0,
    toolCalls: 0,
    fallbackReason: 'no model configured',
  },
];
