/**
 * View models the components render. They are plain, serializable data so stories and the web app
 * can build them without the engines; the web app maps run history, heal audit and agent log into them.
 */
export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface RunRow {
  id: string;
  suite: string;
  /** ISO time. */
  startedAt: string;
  environment: string;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

export interface TestRow {
  id: string;
  title: string;
  file: string;
  project: string;
  status: TestStatus;
  durationMs: number;
  retries: number;
  error?: string;
}

export interface TrendPoint {
  /** Short x label, e.g. a date. */
  label: string;
  value: number;
}

export interface FlakyRow {
  testId: string;
  title: string;
  file: string;
  /** Runs where it passed only on retry, or flipped between runs. */
  flakyRuns: number;
  runs: number;
  lastSeen: string;
}

export interface HealRow {
  id: string;
  /** Stable name of the locator, e.g. "CheckoutPage.payNow". */
  locatorKey: string;
  original: string;
  healed: string;
  /** 0 to 1. */
  score: number;
  outcome: 'healed' | 'suggested' | 'rejected';
  at: string;
  suggestion?: string;
}

export interface AgentRunRow {
  id: string;
  agent: string;
  model: string;
  source: 'model' | 'rules';
  startedAt: string;
  durationMs: number;
  toolCalls: number;
  fallbackReason?: string;
}

export interface NavItem {
  href: string;
  label: string;
}

/** One entry of a chat transcript. */
export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean; stopped?: boolean }
  /** A read-only tool the assistant used, shown so the person can see where an answer came from. */
  | { kind: 'tool'; id: string; name: string; input: unknown }
  /** A write the assistant asked for. Nothing happens until a person approves it. */
  | {
      kind: 'approval';
      id: string;
      tool: string;
      input: unknown;
      state: 'pending' | 'approving' | 'approved' | 'denied' | 'failed';
      result?: string;
    }
  | { kind: 'error'; id: string; text: string };
