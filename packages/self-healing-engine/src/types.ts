/** What we can observe about one DOM element, independent of any browser library. */
export interface ElementDescriptor {
  tag: string;
  role: string;
  accessibleName: string;
  text: string;
  testId: string;
  /** Stable attributes only (id, class, name, type, href, placeholder). */
  attributes: Record<string, string>;
  /** Tag chain from body, e.g. "body>div>form>button". */
  ancestorPath: string;
  /** A CSS path that resolves to exactly this element right now. */
  cssPath: string;
  /**
   * Visible text around the element (its card, row or form).
   * Rules do not score it, because surrounding text such as prices and counts changes freely.
   * It is what lets a model tell apart elements that are otherwise identical.
   */
  context?: string;
}

/** The last known good description of an element a locator pointed at. */
export interface Fingerprint extends ElementDescriptor {
  /** Stable name chosen by the caller, e.g. "LoginPage.loginButton". */
  locatorKey: string;
  /** The locator as written in code. */
  selector: string;
  pageUrl: string;
  updatedAt: string;
}

export interface Candidate {
  element: ElementDescriptor;
  /** Name of the strategy that proposed it. */
  strategy: string;
  /** 0..1 similarity to the fingerprint. */
  score: number;
  /** Playwright code a person can paste in place of the broken locator. */
  suggestion: string;
}

export type HealOutcome = 'healed' | 'refused';

export interface HealDecision {
  outcome: HealOutcome;
  /** Present when outcome is "healed". */
  candidate?: Candidate;
  reason: string;
  /** Best candidates considered, highest score first. Always reported. */
  ranked: Candidate[];
}

export interface HealEvent {
  locatorKey: string;
  testId: string;
  failedSelector: string;
  healedSelector?: string;
  strategy: string;
  score: number;
  outcome: HealOutcome;
  createdAt: string;
}
