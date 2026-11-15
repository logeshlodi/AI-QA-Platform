import path from 'node:path';

/** Run-time files (target status, saved logins, heal history). Git-ignored. */
export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const HISTORY_DIR = path.join(PACKAGE_ROOT, '.aiqa');
export const TARGET_STATUS_FILE = path.join(HISTORY_DIR, 'targets.json');
export const SAUCE_AUTH_FILE = path.join(HISTORY_DIR, 'auth', 'saucedemo-standard.json');
