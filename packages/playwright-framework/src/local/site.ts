import type { BrowserContext, Page } from '@playwright/test';

/**
 * A made-up secure origin for specs that need one. Clipboard, WebAuthn, notifications, IndexedDB and
 * media devices only work in a secure context, and `page.setContent` gives `about:blank`, which is not
 * one. Routing https://localhost:9443 to pages held in memory gives a real origin with no server and no
 * public site: nothing leaves the browser.
 */
export const LOCAL_ORIGIN = 'https://localhost:9443';

export interface LocalFile {
  body: string | Buffer;
  contentType?: string;
  headers?: Record<string, string>;
}

/** Serves `files` (path -> content) at LOCAL_ORIGIN for this page or context. Unknown paths answer 404. */
export async function serveLocal(
  target: Page | BrowserContext,
  files: Record<string, string | LocalFile>,
): Promise<void> {
  await target.route(`${LOCAL_ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const file = files[path];
    if (file === undefined) return route.fulfill({ status: 404, body: 'not found' });
    const {
      body,
      contentType = 'text/html; charset=utf-8',
      headers = {},
    } = typeof file === 'string' ? { body: file } : file;
    await route.fulfill({ status: 200, body, contentType, headers });
  });
}

/** A minimal HTML page with a title and body markup; the viewport tag makes phones and tablets lay it out at device width. */
export const html = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body>${body}</body></html>`;
