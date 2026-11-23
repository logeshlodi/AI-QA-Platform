import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseCsv, readCsv, readYaml } from '../src';

const tmp = (name: string, text: string) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-data-')), name);
  fs.writeFileSync(file, text);
  return file;
};

describe('parseCsv', () => {
  it('reads quoted fields with commas, quotes and line breaks, CRLF and a BOM', () => {
    const text = '﻿name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\nAda,plain\r\n';
    expect(parseCsv(text)).toEqual([
      { name: 'Smith, Jo', note: 'said "hi"\nthen left' },
      { name: 'Ada', note: 'plain' },
    ]);
  });

  it('skips blank lines and names a row with the wrong number of fields', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([{ a: '1', b: '2' }]);
    expect(() => parseCsv('a,b\n1,2,3\n')).toThrow('CSV row 2 has 3 fields, the header has 2');
    expect(() => parseCsv('a\n"open')).toThrow('inside a quoted field');
  });
});

describe('readCsv and readYaml', () => {
  const login = z.object({
    username: z.string(),
    expectPass: z.enum(['yes', 'no']).transform((v) => v === 'yes'),
  });

  it('types every row through the schema', () => {
    const file = tmp('logins.csv', 'username,expectPass\nstandard_user,yes\nlocked_out_user,no\n');
    expect(readCsv(file, login)).toEqual([
      { username: 'standard_user', expectPass: true },
      { username: 'locked_out_user', expectPass: false },
    ]);
  });

  it('names the file, the case and the field when the data is wrong', () => {
    const file = tmp('logins.csv', 'username,expectPass\nstandard_user,maybe\n');
    expect(() => readCsv(file, login)).toThrow(/logins\.csv, case 1: expectPass/);
  });

  it('reads a YAML list, or a document with a cases list, with nesting kept', () => {
    const sort = z.object({ option: z.string(), first: z.object({ name: z.string(), price: z.number() }) });
    const list = tmp('a.yaml', '- option: lohi\n  first: { name: Onesie, price: 7.99 }\n');
    const doc = tmp(
      'b.yaml',
      '# comments are fine\ncases:\n  - option: hilo\n    first:\n      name: Jacket\n      price: 49.99\n',
    );
    expect(readYaml(list, sort)).toEqual([{ option: 'lohi', first: { name: 'Onesie', price: 7.99 } }]);
    expect(readYaml(doc, sort)).toEqual([{ option: 'hilo', first: { name: 'Jacket', price: 49.99 } }]);
    expect(() => readYaml(tmp('c.yaml', 'option: x\n'), sort)).toThrow('expected a list of cases');
  });
});
