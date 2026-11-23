import { expect, test } from '../../src/fixtures';
import { html, LOCAL_ORIGIN, serveLocal } from '../../src/local/site';

/**
 * Apps that keep their session in IndexedDB (Firebase Auth, many offline-first apps) are not signed in
 * by cookies and localStorage alone. `storageState({ indexedDB: true })` saves IndexedDB too, so a
 * saved state really signs the next context in. Without the option, it does not.
 */
const APP = html(
  'Notes',
  `<p id="who" role="status">checking…</p>
   <button id="signin">Sign in</button>
   <script>
     const open = () => new Promise((resolve, reject) => {
       const req = indexedDB.open('auth', 1);
       req.onupgradeneeded = () => req.result.createObjectStore('session');
       req.onsuccess = () => resolve(req.result);
       req.onerror = () => reject(req.error);
     });
     const read = async () => {
       const db = await open();
       return new Promise((resolve) => {
         const get = db.transaction('session').objectStore('session').get('user');
         get.onsuccess = () => resolve(get.result);
       });
     };
     const show = async () => {
       const user = await read();
       document.getElementById('who').textContent = user ? 'Signed in as ' + user.name : 'Signed out';
     };
     document.getElementById('signin').onclick = async () => {
       const db = await open();
       const tx = db.transaction('session', 'readwrite');
       tx.objectStore('session').put({ name: 'qa@example.com', token: 'opaque-token' }, 'user');
       tx.oncomplete = show;
     };
     show();
   </script>`,
);

test('a saved state with IndexedDB signs the next context in; without it, it does not', async ({
  browser,
  page,
  context,
}) => {
  await serveLocal(context, { '/': APP });
  await page.goto(`${LOCAL_ORIGIN}/`);
  await expect(page.getByRole('status')).toHaveText('Signed out');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('status')).toHaveText('Signed in as qa@example.com');

  const withIndexedDb = await context.storageState({ indexedDB: true });
  const without = await context.storageState();
  // The saved IndexedDB content is not part of Playwright's public types; it is in the saved JSON.
  expect(JSON.stringify(withIndexedDb)).toContain('"indexedDB"');
  expect(JSON.stringify(withIndexedDb)).toContain('qa@example.com');
  expect(JSON.stringify(without)).not.toContain('qa@example.com');

  for (const [state, expected] of [
    [withIndexedDb, 'Signed in as qa@example.com'],
    [without, 'Signed out'],
  ] as const) {
    const next = await browser.newContext({ storageState: state });
    await serveLocal(next, { '/': APP });
    const nextPage = await next.newPage();
    await nextPage.goto(`${LOCAL_ORIGIN}/`);
    await expect(nextPage.getByRole('status')).toHaveText(expected);
    await next.close();
  }
});
