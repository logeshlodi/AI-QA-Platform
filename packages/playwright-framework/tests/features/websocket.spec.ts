import { expect, test } from '../../src/fixtures';

// routeWebSocket mocks the server side of a socket, so realtime UI can be tested
// without a backend. No public echo server is stable enough to depend on.
test('routeWebSocket answers messages the page sends', async ({ page }) => {
  await page.routeWebSocket('wss://realtime.example.test/ws', (ws) => {
    ws.onMessage((message) => ws.send(`echo:${String(message)}`));
  });

  const reply = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const socket = new WebSocket('wss://realtime.example.test/ws');
        socket.onopen = () => socket.send('ping');
        socket.onmessage = (event) => resolve(String(event.data));
        socket.onerror = () => reject(new Error('socket error'));
      }),
  );
  expect(reply).toBe('echo:ping');
});
