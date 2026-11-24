import type { Browser } from 'webdriverio';

/**
 * Performance readings from Android itself, through Appium (the server's `adb_shell` feature):
 *
 *  - **cold start**: `am start -W -S` stops the app, starts it, and reports TotalTime, the time
 *    from the launch to the first frame of the activity (what Android Vitals calls time to initial
 *    display);
 *  - **memory**: `dumpsys meminfo`'s TOTAL PSS, the app's share of the RAM it uses;
 *  - **CPU**: the app's share of the CPU over a few seconds of use, from `top`.
 *
 * An emulator is slower and noisier than a phone, so the budgets in the specs are wide: they catch
 * a large regression, not a few percent. The numbers go into the report on every run.
 */

export interface StartTiming {
  totalTimeMs: number;
  waitTimeMs?: number;
  launchState?: string;
}

/** `am start -W` output: `LaunchState: COLD`, `TotalTime: 812`, `WaitTime: 830`. */
export function parseAmStart(output: string): StartTiming {
  const total = /TotalTime:\s*(\d+)/.exec(output)?.[1];
  if (!total) throw new Error(`No TotalTime in am start output:\n${output}`);
  const wait = /WaitTime:\s*(\d+)/.exec(output)?.[1];
  return {
    totalTimeMs: Number(total),
    waitTimeMs: wait ? Number(wait) : undefined,
    launchState: /LaunchState:\s*(\w+)/.exec(output)?.[1],
  };
}

/** `dumpsys meminfo <package>`: the `TOTAL PSS:` summary line (Android 10+), else the TOTAL row. */
export function parseMeminfoPssKb(output: string): number {
  const summary = /TOTAL PSS:\s*(\d+)/.exec(output)?.[1];
  if (summary) return Number(summary);
  const row = /^\s*TOTAL\s+(\d+)/m.exec(output)?.[1];
  if (row) return Number(row);
  throw new Error(`No TOTAL PSS in dumpsys meminfo output:\n${output.slice(0, 500)}`);
}

/** `top -b -n 1 -p <pid>`: the %CPU column of the process's row. */
export function parseTopCpu(output: string, pid: number): number {
  const lines = output.split('\n');
  const header = lines.find((l) => /\bPID\b/.test(l) && /%CPU/.test(l));
  if (!header) throw new Error(`No header in top output:\n${output}`);
  // Android's top (toybox) heads two columns as one word, `S[%CPU]`: the state and the CPU share.
  const columns = header
    .trim()
    .split(/\s+/)
    .flatMap((c) => (c === 'S[%CPU]' ? ['S', '%CPU'] : [c]));
  const cpuIndex = columns.findIndex((c) => c.includes('%CPU'));
  const row = lines.find((l) => l.trim().split(/\s+/)[0] === String(pid));
  if (!row) throw new Error(`Process ${pid} is not in top's output`);
  return Number(row.trim().split(/\s+/)[cpuIndex]);
}

async function shell(driver: Browser, command: string, args: string[]): Promise<string> {
  return String(await driver.execute('mobile: shell', { command, args, timeout: 60_000 }));
}

export async function coldStart(driver: Browser, appPackage: string, activity: string): Promise<StartTiming> {
  return parseAmStart(await shell(driver, 'am', ['start', '-W', '-S', '-n', `${appPackage}/${activity}`]));
}

export async function memoryPssKb(driver: Browser, appPackage: string): Promise<number> {
  return parseMeminfoPssKb(await shell(driver, 'dumpsys', ['meminfo', appPackage]));
}

export async function pidOf(driver: Browser, appPackage: string): Promise<number> {
  const pid = Number((await shell(driver, 'pidof', [appPackage])).trim().split(/\s+/)[0]);
  if (!pid) throw new Error(`${appPackage} is not running`);
  return pid;
}

/** The app's CPU share while `work` runs, sampled once a second; returns the highest sample. */
export async function peakCpuWhile(
  driver: Browser,
  appPackage: string,
  work: () => Promise<void>,
): Promise<number> {
  const pid = await pidOf(driver, appPackage);
  const samples: number[] = [];
  let running = true;
  const sampler = (async () => {
    while (running) {
      samples.push(parseTopCpu(await shell(driver, 'top', ['-b', '-n', '1', '-p', String(pid)]), pid));
    }
  })();
  try {
    await work();
  } finally {
    running = false;
    await sampler;
  }
  return Math.max(0, ...samples);
}
