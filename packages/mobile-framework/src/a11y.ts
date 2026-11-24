import { parseUiTree, type UiNode } from './ui-tree';

/**
 * An accessibility audit of one Android screen, read from the UI tree (the page source). Two
 * rules, both from Android's accessibility guidance and the checks Google's Accessibility Scanner
 * makes:
 *
 *  - **label**: everything a user can tap has something for TalkBack to read: its own text or
 *    content description, or text inside it (TalkBack reads a button's child text);
 *  - **target-size**: everything a user can tap is at least 48 by 48 dp, so a finger can hit it.
 *
 * Elements off screen or with no size are skipped; so are the system bars, which belong to Android.
 */

export interface A11yIssue {
  rule: 'label' | 'target-size';
  /** How to find the element again: its resource ID, else its class and position. */
  element: string;
  detail: string;
}

const MIN_TARGET_DP = 48;
const SYSTEM_IDS = /^(android:id\/(statusBarBackground|navigationBarBackground)|com\.android\.systemui:)/;

export function auditPageSource(xml: string, density: number): A11yIssue[] {
  const root = parseUiTree(xml);
  const minPx = Math.floor((MIN_TARGET_DP * density) / 160);
  const issues: A11yIssue[] = [];
  const visit = (node: UiNode) => {
    const [x1, y1, x2, y2] = node.bounds;
    const width = x2 - x1;
    const height = y2 - y1;
    const actionable = node.clickable && node.displayed && width > 0 && height > 0;
    if (actionable && !SYSTEM_IDS.test(node.resourceId)) {
      const where = describe(node);
      if (!hasLabel(node))
        issues.push({ rule: 'label', element: where, detail: 'nothing for a screen reader to say' });
      if (width < minPx || height < minPx) {
        const dp = (px: number) => Math.round((px * 160) / density);
        issues.push({
          rule: 'target-size',
          element: where,
          detail: `${dp(width)} x ${dp(height)} dp, under ${MIN_TARGET_DP} x ${MIN_TARGET_DP}`,
        });
      }
    }
    node.children.forEach(visit);
  };
  visit(root);
  return issues;
}

function hasLabel(node: UiNode): boolean {
  if (node.text.trim() || node.contentDesc.trim()) return true;
  return node.children.some((child) => !child.clickable && hasLabel(child));
}

function describe(node: UiNode): string {
  const cls = node.class.split('.').pop() ?? node.class;
  if (node.resourceId) return `${cls} ${node.resourceId}`;
  if (node.contentDesc) return `${cls} "${node.contentDesc}"`;
  return `${cls} at [${node.bounds.join(',')}]`;
}
