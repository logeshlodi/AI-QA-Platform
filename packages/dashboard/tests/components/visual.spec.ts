import { expect, test } from '@playwright/test';
import { STORIES } from './stories';

// Linux baselines, made in the Playwright Docker image (see packages/dashboard/README.md).
for (const story of STORIES) {
  test(`${story} looks the same @visual`, async ({ mount }) => {
    const component = await mount(story);
    await expect(component).toHaveScreenshot(`${story.replaceAll('/', '-')}.png`);
  });
}
