import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeProvider, generateData, generateLocator, NullProvider, parseAriaSnapshot } from '../src';

const SNAPSHOT = `
- textbox "Username"
- textbox "Password"
- button "Login"
- heading "Accepted usernames are:" [level=4]
- text: standard_user
- link "Read \\"more\\"":
  - /url: /more
- button "Remove"
- button "Remove"
`;

describe('parseAriaSnapshot', () => {
  it('keeps named elements, unescapes quotes, and drops duplicates and plain text', () => {
    expect(parseAriaSnapshot(SNAPSHOT)).toEqual([
      { role: 'textbox', name: 'Username' },
      { role: 'textbox', name: 'Password' },
      { role: 'button', name: 'Login' },
      { role: 'heading', name: 'Accepted usernames are:' },
      { role: 'link', name: 'Read "more"' },
    ]);
  });
});

describe('generateLocator', () => {
  it('answers from rules, without the model, when one element matches the description', async () => {
    const provider = new FakeProvider([]);
    const suggestion = await generateLocator(provider, SNAPSHOT, 'the Login button');
    expect(suggestion).toEqual({
      role: 'button',
      name: 'Login',
      code: 'page.getByRole("button", { name: "Login", exact: true })',
      source: 'rules',
    });
    expect(provider.calls).toHaveLength(0);
  });

  it('asks the model when rules cannot decide, and only accepts an index from the list', async () => {
    const provider = new FakeProvider(['{"index": 1}']);
    const suggestion = await generateLocator(provider, SNAPSHOT, 'the field for the secret word');
    expect(suggestion).toMatchObject({ role: 'textbox', name: 'Password', source: 'model' });
    expect(provider.calls[0]?.prompt).toContain('1. textbox "Password"');
  });

  it.each(['{"index": 99}', '{"index": -1}', 'page.locator("#made-up")'])(
    'returns nothing for the model answer %s',
    async (answer) => {
      expect(await generateLocator(new FakeProvider([answer]), SNAPSHOT, 'something else')).toBeUndefined();
    },
  );

  it('returns nothing when rules cannot decide and AI is off', async () => {
    expect(await generateLocator(new NullProvider(), SNAPSHOT, 'the secret word field')).toBeUndefined();
  });

  it('never suggests an element that appears twice', async () => {
    expect(await generateLocator(new NullProvider(), SNAPSHOT, 'the Remove button')).toBeUndefined();
  });
});

describe('generateData', () => {
  const schema = z.object({ firstname: z.string().min(1), nights: z.number().int().min(1).max(30) });
  const fallback = () => ({ firstname: 'Fallback', nights: 1 });

  it('returns a model record that fits the schema', async () => {
    const provider = new FakeProvider(['{"firstname":"Asha","nights":3}']);
    const result = await generateData(provider, schema, { hint: 'a short stay', fallback });
    expect(result).toEqual({ data: { firstname: 'Asha', nights: 3 }, source: 'model' });
    expect(provider.calls[0]?.prompt).toContain('"nights"');
  });

  it('asks again after an invalid record, then accepts a valid one', async () => {
    const provider = new FakeProvider(['{"firstname":"","nights":300}', '{"firstname":"Ravi","nights":2}']);
    const result = await generateData(provider, schema, { hint: 'a short stay', fallback });
    expect(result).toEqual({ data: { firstname: 'Ravi', nights: 2 }, source: 'model' });
    expect(provider.calls).toHaveLength(2);
  });

  it('uses the fallback when every answer is invalid', async () => {
    const provider = new FakeProvider(['nope', '{"firstname":7}']);
    expect(await generateData(provider, schema, { hint: 'x', fallback })).toEqual({
      data: { firstname: 'Fallback', nights: 1 },
      source: 'fallback',
    });
  });

  it('uses the fallback, without calling the model, when AI is off', async () => {
    const result = await generateData(new NullProvider(), schema, { hint: 'x', fallback });
    expect(result.source).toBe('fallback');
  });
});
