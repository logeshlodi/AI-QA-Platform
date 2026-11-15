import { expect, test } from '../../src/fixtures';

// How tests are organised and controlled. None of these needs a network.
test.describe('tags, annotations and steps', { tag: ['@lab', '@execution'] }, () => {
  test(
    'a test carries tags and annotations into every report',
    { annotation: { type: 'requirement', description: 'REQ-101' } },
    async () => {
      expect(test.info().tags).toEqual(expect.arrayContaining(['@lab', '@execution']));
      expect(test.info().annotations).toContainEqual(
        expect.objectContaining({ type: 'requirement', description: 'REQ-101' }),
      );
    },
  );

  test('test.step groups actions and returns a value', async ({ page }) => {
    const title = await test.step('load a page', async () => {
      await page.setContent('<title>Steps</title><h1>Hello</h1>');
      return page.title();
    });
    await test.step('check it', async () => {
      expect(title).toBe('Steps');
    });
  });

  test('a test can be skipped by condition', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-only behaviour');
    expect(browserName).toBe('chromium');
  });

  test.fixme('a known-broken test is parked with fixme, visible in the report', async () => {
    expect(1).toBe(2);
  });
});

test.describe('serial mode shares state across ordered tests', () => {
  test.describe.configure({ mode: 'serial' });
  const seen: string[] = [];

  test('first', async () => {
    seen.push('first');
  });
  test('second runs after first, in the same worker', async () => {
    seen.push('second');
    expect(seen).toEqual(['first', 'second']);
  });
});

test.describe('fixtures', () => {
  test.use({ healMode: 'off' });

  test('a worker fixture and an option override are injected by name', async ({ env, healMode }) => {
    expect(env.HEAL_THRESHOLD).toBeGreaterThan(0);
    expect(healMode).toBe('off');
  });
});
