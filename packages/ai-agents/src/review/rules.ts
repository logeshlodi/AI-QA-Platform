/**
 * The spec review rules: CONTRIBUTING.md's "Coding standards for specs", checked in code. ESLint
 * already enforces what it can (every test asserts, no conditional expect, no focused tests);
 * these are the standards it cannot see. Each finding names the section it comes from.
 *
 * A line can opt out with a comment saying why, on the line or the one above, and a file can switch
 * one rule off when breaking it is the file's purpose:
 *   // review-ok: the server is slow on purpose
 *   // review-ok-file: no-xpath — this spec shows why XPath breaks
 */

/** must: fix before merging. should: fix unless there is a reason. consider: readability (model only). */
export type Severity = 'must' | 'should' | 'consider';
export const REVIEW_SECTIONS = [
  'Locators',
  'Waiting',
  'Assertions',
  'Structure',
  'Independence',
  'Targets',
  'Titles',
] as const;
export type ReviewSection = (typeof REVIEW_SECTIONS)[number];

export interface ReviewFinding {
  rule: string;
  line: number;
  severity: Severity;
  section: ReviewSection;
  message: string;
  source: 'rules' | 'model';
}

export type FileKind = 'spec' | 'page-object' | 'other';

export function fileKind(file: string): FileKind {
  if (/\.spec\.tsx?$/.test(file)) return 'spec';
  if (/\/src\/(pages|components|flows)\//.test(file)) return 'page-object';
  return 'other';
}

interface Rule {
  id: string;
  section: ReviewSection;
  severity: Severity;
  applies: FileKind[];
  /** Returns a message when the line breaks the rule. */
  check: (line: string, ctx: { file: string; lines: string[]; index: number }) => string | undefined;
}

const comment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);
const VAGUE_TITLE =
  /^(test|tests|check|checks|verify|verifies|validate)(\s|$)|^(it\s+)?works?$|^should work$|\b(test|case|scenario)\s*\d+\b/i;
// Values that are obviously not real secrets.
const PLACEHOLDER = /fake|dummy|example|placeholder|opaque|not-a-real|not-the-|wrong|changeme|x{4,}/i;

const RULES: Rule[] = [
  {
    id: 'no-fixed-wait',
    section: 'Waiting',
    severity: 'must',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /\bwaitForTimeout\s*\(|(?<![.\w])setTimeout\s*\(|(?<![.\w])sleep\s*\(/.test(l)
        ? 'A fixed wait: wait for a condition you can name (a response, a URL, a web-first assertion).'
        : undefined,
  },
  {
    id: 'no-visibility-branch',
    section: 'Waiting',
    severity: 'must',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /\bif\s*\(.*\.is(Visible|Hidden|Enabled|Checked)\s*\(/.test(l)
        ? 'Branching on isVisible() races the page: assert the state you expect, or split the case.'
        : undefined,
  },
  {
    id: 'no-xpath',
    section: 'Locators',
    severity: 'must',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /locator\(\s*['"`](\/\/|\(\/\/|xpath=)/.test(l)
        ? 'XPath: use getByRole, getByLabel or getByTestId; CSS only when nothing user-facing identifies the element.'
        : undefined,
  },
  {
    id: 'position-needs-reason',
    section: 'Locators',
    severity: 'should',
    applies: ['spec', 'page-object'],
    // Position is often the point of an assertion (after sorting, the first card is the cheapest);
    // acting on "the first of several" is the smell: the locator matches more than the target.
    check: (l, { lines, index }) =>
      /\.(first|last)\(\)\s*\.\s*(click|dblclick|fill|check|uncheck|press|type|hover|tap|selectOption|setInputFiles|dragTo)\(|\.nth\(\s*\d+\s*\)\s*\.\s*(click|dblclick|fill|check|uncheck|press|type|hover|tap|selectOption|setInputFiles|dragTo)\(/.test(
        l,
      ) &&
      !/\s\/\/\s+\S/.test(l) &&
      !comment(lines[index - 1] ?? '')
        ? 'Acting on the first or nth of several matches: narrow the locator to the one element, or say in a comment why position is the point.'
        : undefined,
  },
  {
    id: 'raw-locator-in-journey',
    section: 'Locators',
    severity: 'should',
    applies: ['spec'],
    check: (l, { file }) =>
      /\/tests\/(journeys|smoke)\//.test(file) && /\bpage\.locator\(/.test(l)
        ? 'A raw locator in a journey: define it once in the page object, with a name, and use that.'
        : undefined,
  },
  {
    id: 'no-force',
    section: 'Waiting',
    severity: 'should',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /\.(click|dblclick|fill|check|uncheck|hover|tap|dragTo|selectOption|press|type|setChecked)\([^)]*\bforce:\s*true\b/.test(
        l,
      )
        ? '`force: true` skips the actionability checks that catch real bugs (covered or disabled controls).'
        : undefined,
  },
  {
    id: 'assert-in-specs',
    section: 'Assertions',
    severity: 'should',
    applies: ['page-object'],
    check: (l) =>
      /\bexpect(\.soft)?\s*\(/.test(l) && !/toBeVisible|toHaveURL|toHaveTitle/.test(l)
        ? 'An assertion in a page object: assert in the spec (a page object may only wait for its page to load).'
        : undefined,
  },
  {
    id: 'fixtures-import',
    section: 'Structure',
    severity: 'should',
    applies: ['spec'],
    check: (l, { file }) =>
      /\/playwright-framework\/tests\//.test(file) &&
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/.test(l)
        ? 'Import test and expect from src/fixtures, not @playwright/test, so the spec gets the page objects, healing and checks.'
        : undefined,
  },
  {
    id: 'no-serial',
    section: 'Independence',
    severity: 'should',
    applies: ['spec'],
    check: (l) =>
      /describe\.serial\(|mode:\s*['"]serial['"]/.test(l)
        ? "Serial mode makes tests depend on each other's order: give each test its own data, or a test lock for a shared resource."
        : undefined,
  },
  {
    id: 'no-literal-token',
    section: 'Targets',
    severity: 'must',
    applies: ['spec', 'page-object'],
    check: (l) =>
      (/\b(secret|token|apiKey|api_key|accessKey|clientSecret)\s*[:=]\s*['"`][^'"`$]{8,}['"`]/i.test(l) ||
        /['"`]Bearer\s+[A-Za-z0-9._-]{20,}['"`]/.test(l)) &&
      !PLACEHOLDER.test(l)
        ? 'A token or key written in the code: take it from the environment (it would end up in git and in reports).'
        : undefined,
  },
  {
    id: 'no-literal-password',
    section: 'Targets',
    severity: 'should',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /\b(password|passwd)\s*[:=]\s*['"`][^'"`$]{6,}['"`]/i.test(l) && !PLACEHOLDER.test(l)
        ? "A password written in the spec: take it from the test-data module (even a demo site's public one), so it changes in one place."
        : undefined,
  },
  {
    id: 'no-console',
    section: 'Structure',
    severity: 'should',
    applies: ['spec', 'page-object'],
    check: (l) =>
      /\bconsole\.(log|debug|info)\s*\(/.test(l)
        ? 'console.log in a test: attach what matters with testInfo.attach, or use test.step so it shows in the report.'
        : undefined,
  },
  {
    id: 'title-says-what-user-gets',
    section: 'Titles',
    severity: 'should',
    applies: ['spec'],
    check: (l) => {
      const m = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])(.+?)\1/.exec(l);
      if (!m) return undefined;
      const title = m[2]!;
      // API tests are named after the endpoint by convention: "GET /health".
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//.test(title)) return undefined;
      return VAGUE_TITLE.test(title) || title.trim().split(/\s+/).length < 3
        ? `"${title}" does not say what the user gets: name the behaviour, e.g. "a locked-out user is refused with a reason".`
        : undefined;
    },
  },
];

/** Runs every rule that applies to the file. Lines marked `review-ok` are skipped, with their reason. */
export function reviewByRules(file: string, text: string): ReviewFinding[] {
  const kind = fileKind(file);
  if (kind === 'other') return [];
  const lines = text.split('\n');
  const findings: ReviewFinding[] = [];
  // `// review-ok-file: no-xpath — this spec shows why XPath breaks` switches one rule off for the file.
  const fileOptOuts = new Set([...text.matchAll(/review-ok-file:\s*([\w-]+)\s*\S/g)].map((m) => m[1]!));
  lines.forEach((line, index) => {
    if (comment(line)) return;
    const optedOut = /review-ok:\s*\S/.test(line) || /review-ok:\s*\S/.test(lines[index - 1] ?? '');
    if (optedOut) return;
    for (const rule of RULES) {
      if (!rule.applies.includes(kind) || fileOptOuts.has(rule.id)) continue;
      const message = rule.check(line, { file, lines, index });
      if (message)
        findings.push({
          rule: rule.id,
          line: index + 1,
          severity: rule.severity,
          section: rule.section,
          message,
          source: 'rules',
        });
    }
  });
  return findings;
}

export const REVIEW_RULE_IDS = RULES.map((r) => r.id);
