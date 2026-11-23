import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HealingReview } from '@aiqa/ai-agents';
import { changedTrackedFiles, commitHealBranch, slug, writeHealPatches } from '../src/commands/heal-branch';

const review = (key: string, status: HealingReview['status'] = 'applied'): HealingReview => ({
  locatorKey: key,
  status,
  source: 'rules',
  title: 'Update locator CheckoutPage.payNow',
  body: 'The locator no longer matched.',
  patch: {
    locatorKey: key,
    file: 'src/pages/pay.page.ts',
    line: 2,
    before: "  pay = '#pay';",
    after: "  pay = 'role=button';",
  },
  diff: "--- a/src/pages/pay.page.ts\n+++ b/src/pages/pay.page.ts\n@@ -2,1 +2,1 @@\n-  pay = '#pay';\n+  pay = 'role=button';",
});

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-heal-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@aiqa.test');
  git(dir, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(dir, 'pkg/src/pages'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pkg/src/pages/pay.page.ts'), "class Pay {\n  pay = '#pay';\n}\n");
  fs.writeFileSync(path.join(dir, 'other.txt'), 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

describe('heal patches and branches', () => {
  it('slugs locator keys for file and branch names', () => {
    expect(slug('CheckoutPage.payNow')).toBe('checkoutpage-paynow');
    expect(slug('***')).toBe('heal');
  });

  it('writes a patch git can apply from the repository root, and the description beside it', () => {
    const dir = repo();
    const out = path.join(dir, '.aiqa/heal-patches');
    const [written] = writeHealPatches(
      [review('CheckoutPage.payNow', 'proposed'), { ...review('X', 'refused'), patch: undefined }],
      out,
      'pkg',
    );
    expect(written).toBeDefined();
    expect(fs.readFileSync(written!.patchFile, 'utf8')).toContain('--- a/pkg/src/pages/pay.page.ts');
    expect(fs.readFileSync(written!.descriptionFile, 'utf8')).toMatch(
      /^# Update locator CheckoutPage\.payNow/,
    );
    git(dir, 'apply', '--unidiff-zero', written!.patchFile);
    expect(fs.readFileSync(path.join(dir, 'pkg/src/pages/pay.page.ts'), 'utf8')).toContain(
      "pay = 'role=button';",
    );
  });

  it('commits only the patched file on a heal/* branch', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'pkg/src/pages/pay.page.ts'), "class Pay {\n  pay = 'role=button';\n}\n");
    fs.writeFileSync(path.join(dir, 'other.txt'), 'changed by someone else\n');
    const branch = commitHealBranch(
      dir,
      [review('CheckoutPage.payNow')],
      'pkg',
      new Date('2026-11-23T08:15:00Z'),
    );
    expect(branch).toBe('heal/202611230815');
    expect(git(dir, 'branch', '--show-current')).toBe(branch);
    expect(git(dir, 'show', '--name-only', '--format=%s', 'HEAD').split('\n')).toEqual([
      'fix(heal): update locator CheckoutPage.payNow',
      '',
      'pkg/src/pages/pay.page.ts',
    ]);
    expect(changedTrackedFiles(dir)).toEqual(['other.txt']);
  });

  it('refuses to make an empty branch', () => {
    expect(() => commitHealBranch(repo(), [], 'pkg')).toThrow(/nothing to commit/);
  });
});
