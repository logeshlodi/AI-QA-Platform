import { describe, expect, it } from 'vitest';
import { scoreElement, setSimilarity, suggestLocator, textSimilarity } from '../src';
import { element } from './helpers';

describe('textSimilarity', () => {
  it('is 1 for equal text ignoring case and whitespace', () => {
    expect(textSimilarity('Add  to Cart', 'add to cart')).toBe(1);
  });
  it('is high for a small wording change and low for unrelated text', () => {
    expect(textSimilarity('Add to cart', 'Add item to cart')).toBeGreaterThan(0.7);
    expect(textSimilarity('Add to cart', 'Log out')).toBeLessThan(0.2);
  });
  it('treats two empty strings as no evidence', () => {
    expect(textSimilarity('', '')).toBe(0);
  });
});

describe('setSimilarity', () => {
  it('computes Jaccard overlap', () => {
    expect(setSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
    expect(setSimilarity([], [])).toBe(0);
  });
});

describe('scoreElement', () => {
  const stored = element({
    accessibleName: 'Login',
    text: 'Login',
    attributes: { id: 'btn-123', class: 'btn btn-primary' },
  });

  it('scores 1 when only the generated id changed', () => {
    const live = element({ ...stored, attributes: { id: 'btn-999', class: 'btn btn-primary' } });
    expect(scoreElement(stored, live)).toBe(1);
  });

  it('does not punish a missing test id when the fingerprint never had one', () => {
    expect(scoreElement(stored, element({ ...stored, testId: 'new-id' }))).toBe(1);
  });

  it('drops sharply when the test id differs', () => {
    const withId = element({ ...stored, testId: 'login' });
    expect(scoreElement(withId, element({ ...withId, testId: 'logout' }))).toBeLessThan(0.75);
  });

  it('scores an unrelated element low', () => {
    const other = element({
      tag: 'a',
      role: 'link',
      accessibleName: 'Help',
      text: 'Help',
      ancestorPath: 'body>footer>a',
    });
    expect(scoreElement(stored, other)).toBeLessThan(0.3);
  });
});

describe('suggestLocator', () => {
  it('prefers test id, then role and name, then text, then CSS', () => {
    expect(suggestLocator(element({ testId: 'login', accessibleName: 'Login' }))).toBe(
      "page.getByTestId('login')",
    );
    expect(suggestLocator(element({ accessibleName: "Don't" }))).toBe(
      "page.getByRole('button', { name: 'Don\\'t' })",
    );
    expect(suggestLocator(element({ role: '', text: 'Hello' }))).toBe(
      "page.getByText('Hello', { exact: true })",
    );
    expect(suggestLocator(element({ role: '', cssPath: 'body > i' }))).toBe("page.locator('body > i')");
  });
});
