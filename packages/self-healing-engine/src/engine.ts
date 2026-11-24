import { scoreElement } from './scoring';
import { defaultStrategies, type HealingStrategy } from './strategies';
import { suggestLocator } from './suggestion';
import type { Candidate, ElementDescriptor, Fingerprint, HealDecision } from './types';

export interface HealingEngineOptions {
  /** Minimum similarity a candidate needs. */
  threshold?: number;
  /** How far the best candidate must lead the runner-up to count as unambiguous. */
  margin?: number;
  strategies?: HealingStrategy[];
  /** Optional tie-breaker, consulted only when the rule strategies are ambiguous. */
  tieBreaker?: HealingStrategy;
  /**
   * Writes the fix a person pastes in. Default: Playwright locators (`page.getByRole(...)`); the
   * mobile framework passes its own, for screen-object code (`byId('button-LOGIN')`).
   */
  suggest?: (element: ElementDescriptor) => string;
}

/**
 * Decides whether a lost element can be re-identified.
 *
 * The engine never returns a guess. It heals only when exactly one candidate is
 * clearly best; otherwise it refuses and reports what it saw, so a person decides.
 */
export class HealingEngine {
  private readonly threshold: number;
  private readonly margin: number;
  private readonly strategies: HealingStrategy[];
  private readonly tieBreaker?: HealingStrategy;
  private readonly suggest: (element: ElementDescriptor) => string;

  constructor(options: HealingEngineOptions = {}) {
    this.threshold = options.threshold ?? 0.75;
    this.margin = options.margin ?? 0.05;
    this.strategies = options.strategies ?? defaultStrategies();
    this.tieBreaker = options.tieBreaker;
    this.suggest = options.suggest ?? suggestLocator;
  }

  async heal(fingerprint: Fingerprint, elements: ElementDescriptor[]): Promise<HealDecision> {
    const proposedBy = new Map<ElementDescriptor, string>();
    for (const strategy of this.strategies) {
      for (const element of await strategy.propose({ fingerprint, elements })) {
        if (!proposedBy.has(element)) proposedBy.set(element, strategy.name);
      }
    }

    const toCandidate = (element: ElementDescriptor, strategy: string): Candidate => ({
      element,
      strategy,
      score: scoreElement(fingerprint, element),
      suggestion: this.suggest(element),
    });
    const ranked = [...proposedBy].map(([e, s]) => toCandidate(e, s)).sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 5);
    const [best, second] = ranked;

    if (!best)
      return {
        outcome: 'refused',
        reason: 'No element on the page resembles the stored fingerprint.',
        ranked: top,
      };
    if (best.score < this.threshold) {
      return {
        outcome: 'refused',
        reason: `Best candidate scored ${best.score.toFixed(2)}, below the ${this.threshold} threshold.`,
        ranked: top,
      };
    }
    if (!second || best.score - second.score >= this.margin) {
      return {
        outcome: 'healed',
        candidate: best,
        reason: `One clear match (score ${best.score.toFixed(2)}).`,
        ranked: top,
      };
    }

    // Ambiguous: several elements pass the threshold. Only a tie-breaker may choose,
    // and its choice still has to be one of the elements that passed.
    const passing = ranked.filter((c) => c.score >= this.threshold);
    if (this.tieBreaker) {
      const [picked] = await this.tieBreaker.propose({
        fingerprint,
        elements: passing.map((c) => c.element),
      });
      const match = passing.find((c) => c.element === picked);
      if (match) {
        return {
          outcome: 'healed',
          candidate: { ...match, strategy: this.tieBreaker.name },
          reason: `${passing.length} elements matched; ${this.tieBreaker.name} chose one (score ${match.score.toFixed(2)}).`,
          ranked: top,
        };
      }
    }
    return {
      outcome: 'refused',
      reason: `Ambiguous: ${passing.length} elements score within ${this.margin} of each other.`,
      ranked: top,
    };
  }
}
