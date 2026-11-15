import { prompts } from '../prompts';
import type { LlmProvider } from '../provider';

export interface BugReportInput {
  title: string;
  steps: string[];
  errorMessage: string;
  evidence?: string[];
}

/** Template used when no model is available, so a report always exists. */
export function templateBugReport(input: BugReportInput): string {
  const list = (items: string[]) => items.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return [
    `## Summary\n${input.title} failed.`,
    `## Steps to reproduce\n${list(input.steps) || 'Not recorded.'}`,
    `## Actual\n\`\`\`\n${input.errorMessage.trim()}\n\`\`\``,
    `## Evidence\n${(input.evidence ?? []).map((e) => `- ${e}`).join('\n') || 'None attached.'}`,
  ].join('\n\n');
}

export async function draftBugReport(input: BugReportInput, provider?: LlmProvider): Promise<string> {
  if (provider && (await provider.isAvailable())) {
    try {
      const text = await provider.complete({
        system: prompts.bugReport.system,
        prompt: prompts.bugReport.user(input.title, input.steps, input.errorMessage),
      });
      if (text.trim()) return text.trim();
    } catch {
      // fall through to the template
    }
  }
  return templateBugReport(input);
}
