import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';

/**
 * Test data kept in files people edit by hand: CSV for tables a spreadsheet exports, YAML for nested
 * cases with comments. Every row is checked against a zod schema when it is read, so a typo in the
 * data fails with the row and field named, before any test runs on it.
 */

/** Parses CSV text (RFC 4180: quoted fields, "" for a quote, commas and line breaks inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^﻿/, ''); // a BOM from Excel
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (!header) return [];
  return body.map((cells, n) => {
    if (cells.length !== header.length) {
      throw new Error(`CSV row ${n + 2} has ${cells.length} fields, the header has ${header.length}`);
    }
    return Object.fromEntries(header.map((name, i) => [name.trim(), cells[i]!]));
  });
}

function check<T>(rows: unknown[], schema: z.ZodType<T>, source: string): T[] {
  return rows.map((row, n) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`${source}, case ${n + 1}: ${issue?.path.join('.') || '(row)'}: ${issue?.message}`);
    }
    return parsed.data;
  });
}

/** Reads a CSV file into typed rows. Values arrive as strings: use z.coerce for numbers and booleans. */
export function readCsv<T>(file: string, schema: z.ZodType<T>): T[] {
  return check(parseCsv(fs.readFileSync(file, 'utf8')), schema, file);
}

/** Reads a YAML file whose top level is a list (or `{ cases: [...] }`) into typed cases. */
export function readYaml<T>(file: string, schema: z.ZodType<T>): T[] {
  const doc = parseYaml(fs.readFileSync(file, 'utf8')) as unknown;
  const list = Array.isArray(doc) ? doc : (doc as { cases?: unknown[] } | null)?.cases;
  if (!Array.isArray(list)) throw new Error(`${file}: expected a list of cases, or "cases:" with a list`);
  return check(list, schema, file);
}
