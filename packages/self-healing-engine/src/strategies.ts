import { pickElement, type LlmProvider } from '@aiqa/ai-engine';
import { textSimilarity } from './similarity';
import type { ElementDescriptor, Fingerprint } from './types';

export interface HealContext {
  fingerprint: Fingerprint;
  elements: ElementDescriptor[];
}

/**
 * Strategy pattern: each way of finding a lost element is one small class.
 * A strategy only PROPOSES elements; the engine alone decides, with one scoring
 * function, whether a proposal is good enough. That keeps every strategy,
 * including the model-backed one, under the same rule.
 */
export interface HealingStrategy {
  readonly name: string;
  propose(context: HealContext): Promise<ElementDescriptor[]> | ElementDescriptor[];
}

export class TestIdStrategy implements HealingStrategy {
  readonly name = 'testId';
  propose({ fingerprint, elements }: HealContext): ElementDescriptor[] {
    if (!fingerprint.testId) return [];
    return elements.filter((e) => e.testId === fingerprint.testId);
  }
}

export class RoleNameStrategy implements HealingStrategy {
  readonly name = 'role';
  propose({ fingerprint, elements }: HealContext): ElementDescriptor[] {
    if (!fingerprint.role || !fingerprint.accessibleName) return [];
    return elements.filter(
      (e) =>
        e.role === fingerprint.role && textSimilarity(e.accessibleName, fingerprint.accessibleName) >= 0.8,
    );
  }
}

export class TextStrategy implements HealingStrategy {
  readonly name = 'text';
  propose({ fingerprint, elements }: HealContext): ElementDescriptor[] {
    if (!fingerprint.text) return [];
    return elements.filter((e) => textSimilarity(e.text, fingerprint.text) >= 0.8);
  }
}

export class AttributeStrategy implements HealingStrategy {
  readonly name = 'attributes';
  propose({ fingerprint, elements }: HealContext): ElementDescriptor[] {
    const wanted = new Set((fingerprint.attributes.class ?? '').split(/\s+/).filter(Boolean));
    const name = fingerprint.attributes.name;
    return elements.filter((e) => {
      if (e.tag !== fingerprint.tag) return false;
      if (name && e.attributes.name === name) return true;
      const classes = (e.attributes.class ?? '').split(/\s+/).filter(Boolean);
      return wanted.size > 0 && classes.filter((c) => wanted.has(c)).length >= Math.ceil(wanted.size / 2);
    });
  }
}

const describe = (e: ElementDescriptor) =>
  `<${e.tag}> role=${e.role || '-'} name="${e.accessibleName}" text="${e.text.slice(0, 80)}" ` +
  `testId="${e.testId}" class="${e.attributes.class ?? ''}" path=${e.ancestorPath} near="${(e.context ?? '').slice(0, 140)}"`;

/**
 * Asks a language model to choose among elements the rules could not separate.
 * It can only pick from the list it is given, so it cannot invent a selector.
 */
export class LlmStrategy implements HealingStrategy {
  readonly name = 'llm';
  constructor(
    private readonly provider: LlmProvider,
    private readonly maxCandidates = 15,
  ) {}

  async propose({ fingerprint, elements }: HealContext): Promise<ElementDescriptor[]> {
    if (elements.length === 0 || !(await this.provider.isAvailable())) return [];
    const shortlist = elements.slice(0, this.maxCandidates);
    const index = await pickElement(this.provider, describe(fingerprint), shortlist.map(describe));
    const chosen = index === undefined ? undefined : shortlist[index];
    return chosen ? [chosen] : [];
  }
}

export const defaultStrategies = (): HealingStrategy[] => [
  new TestIdStrategy(),
  new RoleNameStrategy(),
  new TextStrategy(),
  new AttributeStrategy(),
];
