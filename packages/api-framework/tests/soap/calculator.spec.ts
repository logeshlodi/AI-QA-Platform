import { expect, test } from '../../src/fixtures';

test.describe('SOAP: calculator service', () => {
  for (const row of [
    { operation: 'Add', a: 12, b: 30, result: 42 },
    { operation: 'Subtract', a: 50, b: 8, result: 42 },
    { operation: 'Multiply', a: 6, b: 7, result: 42 },
  ]) {
    test(`${row.operation}(${row.a}, ${row.b}) = ${row.result}`, async ({ calculator }) => {
      const { status, body } = await calculator.call(row.operation, { intA: row.a, intB: row.b });
      expect(status).toBe(200);
      expect(body).toEqual({ [`${row.operation}Response`]: { [`${row.operation}Result`]: row.result } });
    });
  }

  test('the envelope escapes XML special characters', async ({ calculator }) => {
    expect(calculator.envelope('Echo', { text: 'a<b & c>d' })).toContain('<text>a&lt;b &amp; c&gt;d</text>');
  });
});
