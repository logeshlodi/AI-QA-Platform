import { describe, expect, it } from 'vitest';
import { consoleReporter } from '../src';

describe('consoleReporter', () => {
  it('is the list reporter unless PW_CONSOLE_REPORTER picks another', () => {
    expect(consoleReporter(undefined)).toEqual([['list']]);
    expect(consoleReporter('dot')).toEqual([['dot']]);
    expect(consoleReporter('line')).toEqual([['line']]);
  });

  it('refuses a reporter it does not know, naming the ones it does', () => {
    expect(() => consoleReporter('dots')).toThrow('PW_CONSOLE_REPORTER must be one of list, line, dot');
  });
});
