import type { Fingerprint, HealDecision } from './types';

/** Markdown evidence attached to the test report for every heal and every refusal. */
export function formatHealReport(fingerprint: Fingerprint, decision: HealDecision): string {
  const rows = decision.ranked.map(
    (c, i) => `| ${i + 1} | ${c.score.toFixed(2)} | ${c.strategy} | \`${c.suggestion}\` |`,
  );
  const lines = [
    `# Self-healing: ${decision.outcome.toUpperCase()}`,
    '',
    `- Locator key: \`${fingerprint.locatorKey}\``,
    `- Broken locator: \`${fingerprint.selector}\``,
    `- Page: ${fingerprint.pageUrl}`,
    `- Decision: ${decision.reason}`,
    '',
  ];
  if (decision.candidate) {
    lines.push(
      '## Suggested fix',
      '',
      '```diff',
      `- ${fingerprint.selector}`,
      `+ ${decision.candidate.suggestion}`,
      '```',
      '',
    );
  }
  lines.push(
    '## Candidates considered',
    '',
    '| # | Score | Strategy | Locator |',
    '| --- | --- | --- | --- |',
  );
  lines.push(...(rows.length ? rows : ['| - | - | - | none |']));
  return lines.join('\n');
}
