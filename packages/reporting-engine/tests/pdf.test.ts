import { describe, expect, it } from 'vitest';
import { renderDashboard, reportInput } from '../src';
import { run } from './helpers';

describe('reportInput', () => {
  const runs = [run({ a: ['passed'] }, 'ui'), run({ b: ['failed'] }, 'api'), run({ c: ['passed'] }, 'ui')];

  it('takes every run, or one suite, and names the report after it', () => {
    expect(reportInput(runs)).toMatchObject({ title: 'AI-QA-Platform test report' });
    expect(reportInput(runs).runs).toHaveLength(3);
    const ui = reportInput(runs, { suite: 'ui' });
    expect(ui.runs.map((r) => r.run.suite)).toEqual(['ui', 'ui']);
    expect(ui.title).toBe('AI-QA-Platform test report: ui suite');
    expect(reportInput(runs, { title: 'Nightly' }).title).toBe('Nightly');
  });
});

describe('print mode', () => {
  it('drops the tooltip script and hover hint, and keeps the print styles', () => {
    const html = renderDashboard([run({ a: ['passed'] })], { print: true });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('hover or tab');
    expect(html).toContain('@media print');
    expect(renderDashboard([run({ a: ['passed'] })])).toContain('<script>');
  });
});
