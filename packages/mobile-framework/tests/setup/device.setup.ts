import { test as setup, expect } from '@playwright/test';
import { mobileConfig } from '../../src/config';
import { checkReadiness, formatChecks } from '../../src/doctor';

// Fails fast, with the fix in the message, when the machine cannot run the Android suite yet.
setup('the Android SDK, a device or emulator, and the apps are ready', async () => {
  const checks = await checkReadiness(mobileConfig());
  const missing = checks.filter((c) => !c.ok);
  expect(missing, `\n${formatChecks(checks)}\n`).toEqual([]);
});
