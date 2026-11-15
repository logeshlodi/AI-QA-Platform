import type { ElementDescriptor, Fingerprint } from '../src';

export const element = (over: Partial<ElementDescriptor> = {}): ElementDescriptor => ({
  tag: 'button',
  role: 'button',
  accessibleName: '',
  text: '',
  testId: '',
  attributes: {},
  ancestorPath: 'body>div>button',
  cssPath: 'body > div > button',
  context: '',
  ...over,
});

export const fingerprint = (over: Partial<Fingerprint> = {}): Fingerprint => ({
  ...element(),
  locatorKey: 'Page.button',
  selector: "locator('#old-id')",
  pageUrl: 'https://example.test/',
  updatedAt: '2026-11-13T00:00:00.000Z',
  ...over,
});
