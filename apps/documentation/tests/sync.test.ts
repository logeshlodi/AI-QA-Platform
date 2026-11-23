import { describe, expect, it } from 'vitest';
import { convert, slugOf } from '../scripts/sync';

describe('docs sync', () => {
  it('turns file paths into the site slugs Astro gives them', () => {
    expect(slugOf('STATUS.md')).toBe('status/');
    expect(slugOf('learning/README.md')).toBe('learning/');
    expect(slugOf('adr/0014-agents-rules-first-on-the-ai-sdk.md')).toBe(
      'adr/0014-agents-rules-first-on-the-ai-sdk/',
    );
  });

  it('moves the heading into the frontmatter title, quoting it safely', () => {
    const page = convert(
      '# Testing AI features: streaming\n\nBody',
      'learning/13-testing-ai-features.md',
      '/',
    );
    expect(page).toMatch(/^---\ntitle: "Testing AI features: streaming"\n/);
    expect(page).not.toContain('# Testing AI features');
    expect(page).toContain('Body');
  });

  it('links docs to site pages under the base, and everything else to GitHub', () => {
    const page = convert(
      '# T\n[a](08-contracts.md#pact) [b](../adr/0014-x.md) [c](../adr) [d](../../packages/examples) [e](https://playwright.dev) [f](#here)',
      'learning/README.md',
      '/AI-QA-Platform/',
    );
    expect(page).toContain('[a](/AI-QA-Platform/learning/08-contracts/#pact)');
    expect(page).toContain('[b](/AI-QA-Platform/adr/0014-x/)');
    expect(page).toContain('[c](/AI-QA-Platform/adr/)');
    expect(page).toContain('[d](https://github.com/logeshlodi/AI-QA-Platform/blob/main/packages/examples)');
    expect(page).toContain('[e](https://playwright.dev)');
    expect(page).toContain('[f](#here)');
  });
});
