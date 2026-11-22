import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Serves the story gallery for component tests and browsing: http://localhost:3100/playwright/gallery/index.html */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  server: { port: 3100, strictPort: true },
  logLevel: 'warn',
});
