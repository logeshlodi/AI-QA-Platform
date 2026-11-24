import type { TestInfo } from '@playwright/test';
import type { Browser } from 'webdriverio';

/**
 * What a failing mobile test leaves behind, attached to the Playwright report: what the screen
 * showed, the UI tree the locators ran against, the device log, the server log and a video.
 * Each item is collected on its own; one that the driver cannot give is noted, not fatal.
 */
export interface EvidenceSources {
  driver: Browser;
  /** The Appium server's log for this test. */
  serverLog?: () => string;
  /** The base64 MP4 from stopRecordingScreen, when a recording was running. */
  video?: string;
}

export interface EvidenceResult {
  attached: string[];
  unavailable: Record<string, string>;
}

export async function attachEvidence(testInfo: TestInfo, sources: EvidenceSources): Promise<EvidenceResult> {
  const result: EvidenceResult = { attached: [], unavailable: {} };
  const attempt = async (
    name: string,
    collect: () => Promise<{ body: string | Buffer; contentType: string } | undefined>,
  ) => {
    try {
      const item = await collect();
      if (!item) return;
      await testInfo.attach(name, item);
      result.attached.push(name);
    } catch (error) {
      result.unavailable[name] = error instanceof Error ? error.message.split('\n')[0]! : String(error);
    }
  };
  const { driver } = sources;

  await attempt('screen.png', async () => ({
    body: Buffer.from(await driver.takeScreenshot(), 'base64'),
    contentType: 'image/png',
  }));
  await attempt('page-source.xml', async () => ({
    body: await driver.getPageSource(),
    contentType: 'application/xml',
  }));
  await attempt('logcat.txt', async () => {
    const types = (await driver.getLogTypes()) as string[];
    if (!types.includes('logcat')) return undefined;
    const entries = (await driver.getLogs('logcat')) as {
      timestamp: number;
      level: string;
      message: string;
    }[];
    return {
      body: entries
        .slice(-400)
        .map((e) => `${e.level} ${e.message}`)
        .join('\n'),
      contentType: 'text/plain',
    };
  });
  if (sources.serverLog) {
    const log = sources.serverLog();
    await attempt('appium.log', async () => (log ? { body: log, contentType: 'text/plain' } : undefined));
  }
  if (sources.video) {
    const video = sources.video;
    await attempt('screen.mp4', async () => ({
      body: Buffer.from(video, 'base64'),
      contentType: 'video/mp4',
    }));
  }
  if (Object.keys(result.unavailable).length) {
    await testInfo.attach('evidence-notes.json', {
      body: JSON.stringify(result.unavailable, null, 2),
      contentType: 'application/json',
    });
  }
  return result;
}
