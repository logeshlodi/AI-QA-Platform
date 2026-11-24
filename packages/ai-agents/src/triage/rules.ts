import type { TriageContext, TriageLabel } from './context';

export interface RuleVerdict {
  label: TriageLabel;
  reason: string;
  evidence: string[];
}

const NETWORK =
  /net::ERR_|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up|getaddrinfo|\b50[234]\b|Service Unavailable|Bad Gateway/i;
const LOCATOR =
  /strict mode violation|waiting for (locator|getBy)|locator\.\w+: Timeout|element is not (visible|enabled|attached)/i;
/** A device or Appium that stopped answering: the run's machine, not the app or the test. */
const DEVICE =
  /device (offline|unauthorized|'[^']*' not found)|no (connected )?(android )?devices?|Could not find a connected Android device|instrumentation process is not running|UiAutomator2 server|A session is either terminated or not started|Could not proxy command|Appium did not answer|did not get ready within/i;
/** Appium's way of saying a locator found nothing. */
const MOBILE_LOCATOR =
  /still not (displayed|existing) after|An element could not be located|no such element/i;
const ASSERTION = /expect\(.*\)\.(not\.)?to\w+|Expected:[\s\S]*Received:/i;

const greenRedFlips = (ctx: TriageContext): number => {
  const green = [...ctx.previous.map((p) => p.outcome !== 'failed'), false];
  return green.filter((g, i) => i > 0 && g !== green[i - 1]).length;
};

/**
 * Plain-code triage, in a fixed order: each rule needs one clear signal and says which.
 * Returns nothing when no rule is sure; the model is asked only then.
 */
export function triageByRules(ctx: TriageContext): RuleVerdict | undefined {
  const attempts = ctx.attempts.join(' → ');
  if (ctx.attempts.length > 1 && ctx.attempts.at(-1) === 'passed') {
    return {
      label: 'flaky',
      reason: 'It failed and then passed on a retry in the same run, with nothing changed in between.',
      evidence: [`attempts: ${attempts}`],
    };
  }
  if (NETWORK.test(ctx.errorMessage)) {
    return {
      label: 'environment',
      reason: 'The error is a network or server-availability error, not an answer from the application.',
      evidence: [`error: ${ctx.errorMessage.split('\n')[0]}`],
    };
  }
  if (DEVICE.test(ctx.errorMessage)) {
    return {
      label: 'environment',
      reason: 'The device or Appium stopped answering; the app was never asked.',
      evidence: [`error: ${ctx.errorMessage.split('\n')[0]}`],
    };
  }
  // Many tests failing the same way at once points at the target or the stack, not at one test.
  if (ctx.run.sameError >= 3 && ctx.run.failing / Math.max(ctx.run.total, 1) >= 0.2) {
    return {
      label: 'environment',
      reason: `${ctx.run.sameError} other tests failed with the same error in this run.`,
      evidence: [
        `${ctx.run.failing} of ${ctx.run.total} tests failed`,
        `same error: ${ctx.run.sameError + 1} tests`,
      ],
    };
  }
  const flips = greenRedFlips(ctx);
  if (flips >= 3) {
    return {
      label: 'flaky',
      reason: `Its result keeps changing between runs (${flips} green/red changes) without a pattern.`,
      evidence: [`history: ${ctx.previous.map((p) => p.outcome).join(', ')}, failed`],
    };
  }
  if (LOCATOR.test(ctx.errorMessage) || MOBILE_LOCATOR.test(ctx.errorMessage)) {
    return {
      label: 'test',
      reason: 'A locator did not resolve: the page changed under the test, or the locator is wrong.',
      evidence: [`error: ${ctx.errorMessage.split('\n')[0]}`],
    };
  }
  if (ASSERTION.test(ctx.errorMessage)) {
    return {
      label: 'product',
      reason:
        'An assertion on what the application did failed, and nothing points at the test or the environment.',
      evidence: [`error: ${ctx.errorMessage.split('\n')[0]}`],
    };
  }
  return undefined;
}
