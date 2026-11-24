import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import {
  createHealRepository,
  formatHealReport,
  HealingEngine,
  type ElementDescriptor,
  type HealRepository,
} from '@aiqa/self-healing-engine';
import type { HealMode } from '@aiqa/shared';
import type { Browser } from 'webdriverio';
import { PACKAGE_DIR } from './config';
import { allNodes, parseUiTree, type UiNode } from './ui-tree';

/**
 * Self-healing for screen objects, on the same engine as the web framework's page objects.
 *
 *   const login = await this.locate('LoginScreen.loginButton', 'byId', 'button-LOGIN');
 *
 * When the locator works, the element is fingerprinted (from Android's UI tree) for next time.
 * When it does not, the engine looks for the same element on the screen and, by mode:
 *   off      rethrow the original error
 *   suggest  fail, with a report and a pasteable fix attached (default)
 *   runtime  carry on with the element it found, and log it
 * The fix is screen-object code (`byId('button-LOG-IN')`), so `aiqa agents heal-review
 * --package mobile` can turn it into a one-line patch for a person to review. Nothing is rewritten
 * by the run itself.
 */

export type LocatorMethod = 'byId' | 'byResourceId' | 'byText';

/** Where the mobile framework keeps its fingerprints and heal events. Git-ignored. */
export const MOBILE_STATE_DIR = path.join(PACKAGE_DIR, '.aiqa');

const SYSTEM = /^(android:id\/(statusBarBackground|navigationBarBackground)|com\.android\.systemui:)/;
const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The selector a screen object method builds, in the form WebdriverIO takes. */
export function selectorFor(method: LocatorMethod, value: string): string {
  if (method === 'byId') return `~${value}`;
  const attr = method === 'byResourceId' ? 'resourceId' : 'text';
  return `android=new UiSelector().${attr}(${JSON.stringify(value)})`;
}

/** How the locator reads in a screen object's source, which is what a patch replaces. */
export function sourceFor(method: LocatorMethod, value: string): string {
  return `${method}(${quote(value)})`;
}

/** What TalkBack would read for a view: its own text, else the text inside it. */
function readText(node: UiNode): string {
  if (node.text.trim()) return node.text.trim();
  return node.children.map(readText).filter(Boolean).join(' ').slice(0, 200);
}

/** One view as the healing engine sees elements. */
export function describeNode(node: UiNode): ElementDescriptor {
  const short = node.class.split('.').pop() ?? node.class;
  return {
    tag: node.class,
    role: short,
    // Android's content description is both the accessibility ID tests use and what TalkBack says.
    accessibleName: node.contentDesc,
    text: readText(node),
    // The resource ID is the developer's own stable name, as a test id is on the web.
    testId: node.resourceId,
    attributes: { class: node.class, ...(node.clickable ? { clickable: 'true' } : {}) },
    ancestorPath: [...node.path, node.class].map((c) => c.split('.').pop()).join('>'),
    cssPath: suggestScreenLocator({
      accessibleName: node.contentDesc,
      testId: node.resourceId,
      text: readText(node),
    }),
  };
}

/** Every view on the screen that something could name: an ID, a description or text. */
export function describeAndroid(xml: string, limit = 400): ElementDescriptor[] {
  return allNodes(parseUiTree(xml))
    .filter((n) => n.displayed && !SYSTEM.test(n.resourceId) && (n.contentDesc || n.resourceId || n.text))
    .slice(0, limit)
    .map(describeNode);
}

/** The screen-object locator for an element, best first: accessibility ID, resource ID, text. */
export function suggestScreenLocator(
  e: Pick<ElementDescriptor, 'accessibleName' | 'testId' | 'text'>,
): string {
  if (e.accessibleName) return sourceFor('byId', e.accessibleName);
  if (e.testId) return sourceFor('byResourceId', e.testId);
  if (e.text && e.text.length <= 60) return sourceFor('byText', e.text);
  return '/* no stable locator: add an accessibility ID to this view */';
}

/** Finds the view a method and value name in the UI tree, the way UiAutomator2 would. */
export function findNode(xml: string, method: LocatorMethod, value: string): UiNode | undefined {
  return allNodes(parseUiTree(xml)).find((n) =>
    method === 'byId'
      ? n.contentDesc === value
      : method === 'byResourceId'
        ? n.resourceId === value
        : n.text === value,
  );
}

/** A locator in screen-object code (`byId('x')`) back to its method and value. */
export function parseSourceLocator(code: string): { method: LocatorMethod; value: string } | undefined {
  const m = /^(byId|byResourceId|byText)\('((?:[^'\\]|\\.)*)'\)$/.exec(code);
  return m ? { method: m[1] as LocatorMethod, value: m[2]!.replace(/\\(.)/g, '$1') } : undefined;
}

export interface ScreenHealerDeps {
  engine: HealingEngine;
  repository: HealRepository;
  mode: HealMode;
  /** How long to wait for the original locator before trying to heal. */
  timeoutMs?: number;
}

export class ScreenHealer {
  constructor(
    private readonly driver: Browser,
    private readonly testInfo: TestInfo,
    private readonly deps: ScreenHealerDeps,
  ) {}

  async locate(locatorKey: string, method: LocatorMethod, value: string) {
    const { engine, repository, mode } = this.deps;
    const primary = this.driver.$(selectorFor(method, value));
    const failedSelector = sourceFor(method, value);
    try {
      await primary.waitForExist({ timeout: this.deps.timeoutMs ?? 3_000 });
    } catch (error) {
      if (mode === 'off') throw error;
      const fingerprint = repository.getFingerprint(locatorKey);
      if (!fingerprint) throw error;
      const elements = describeAndroid(await this.driver.getPageSource());
      const decision = await engine.heal({ ...fingerprint, selector: failedSelector }, elements);
      repository.recordEvent({
        locatorKey,
        testId: this.testInfo.testId,
        failedSelector,
        healedSelector: decision.candidate?.element.cssPath,
        suggestion: decision.candidate?.suggestion,
        strategy: decision.candidate?.strategy ?? 'none',
        score: decision.candidate?.score ?? decision.ranked[0]?.score ?? 0,
        outcome: decision.outcome,
        createdAt: new Date().toISOString(),
      });
      await this.testInfo.attach(`heal-${locatorKey}`, {
        body: formatHealReport({ ...fingerprint, selector: failedSelector }, decision),
        contentType: 'text/markdown',
      });
      this.testInfo.annotations.push({
        type: `heal-${decision.outcome}`,
        description: `${locatorKey}: ${decision.reason}`,
      });

      const healed = decision.candidate && parseSourceLocator(decision.candidate.suggestion);
      if (decision.outcome === 'healed' && healed && mode === 'runtime') {
        return this.driver.$(selectorFor(healed.method, healed.value));
      }
      const hint = decision.candidate ? ` Suggested fix: ${decision.candidate.suggestion}` : '';
      throw new Error(
        `Locator "${locatorKey}" (${failedSelector}) was not found. ${decision.reason}${hint}`,
        {
          cause: error,
        },
      );
    }

    if (!repository.getFingerprint(locatorKey)) {
      const node = findNode(await this.driver.getPageSource(), method, value);
      if (node) {
        repository.saveFingerprint({
          ...describeNode(node),
          locatorKey,
          selector: failedSelector,
          pageUrl: (await this.driver.getCurrentActivity().catch(() => '')) || 'android',
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return primary;
  }
}

/** The healer for one test: SQLite (or JSON) heal history in the package's own `.aiqa`. */
export function createScreenHealer(
  driver: Browser,
  testInfo: TestInfo,
  mode: HealMode,
  threshold: number,
  dir = MOBILE_STATE_DIR,
): { healer: ScreenHealer; close: () => void } {
  const repository = createHealRepository(dir);
  const engine = new HealingEngine({ threshold, suggest: suggestScreenLocator });
  return {
    healer: new ScreenHealer(driver, testInfo, { engine, repository, mode }),
    close: () => repository.close(),
  };
}
