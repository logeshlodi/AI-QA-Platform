/**
 * Starting Playwright MCP from the repository's own config, for the tests and for anyone scripting it.
 * The server is `@playwright/mcp` on the repository's Playwright (see the override in
 * pnpm-workspace.yaml); every capability is switched on in `playwright-mcp.config.json`.
 */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const CONFIG = path.join(PACKAGE_DIR, 'playwright-mcp.config.json');
/** The server runs from the repository root, as `.mcp.json` starts it, so output lands in `.aiqa/`. */
export const REPO_ROOT = path.resolve(PACKAGE_DIR, '..', '..');
const CLI = path.join(PACKAGE_DIR, 'node_modules', '@playwright', 'mcp', 'cli.js');

/** Which tools each capability adds, as Playwright 1.65 ships them. `core` is always on. */
export const TOOL_GROUPS = {
  core: [
    'browser_click',
    'browser_close',
    'browser_console_messages',
    'browser_drag',
    'browser_drop',
    'browser_emulate_media',
    'browser_evaluate',
    'browser_file_upload',
    'browser_fill_form',
    'browser_find',
    'browser_handle_dialog',
    'browser_hover',
    'browser_navigate',
    'browser_navigate_back',
    'browser_network_request',
    'browser_network_requests',
    'browser_press_key',
    'browser_resize',
    'browser_run_code_unsafe',
    'browser_select_option',
    'browser_snapshot',
    'browser_tabs',
    'browser_take_screenshot',
    'browser_type',
    'browser_wait_for',
  ],
  network: ['browser_network_state_set', 'browser_route', 'browser_route_list', 'browser_unroute'],
  storage: [
    'browser_cookie_clear',
    'browser_cookie_delete',
    'browser_cookie_get',
    'browser_cookie_list',
    'browser_cookie_set',
    'browser_localstorage_clear',
    'browser_localstorage_delete',
    'browser_localstorage_get',
    'browser_localstorage_list',
    'browser_localstorage_set',
    'browser_sessionstorage_clear',
    'browser_sessionstorage_delete',
    'browser_sessionstorage_get',
    'browser_sessionstorage_list',
    'browser_sessionstorage_set',
    'browser_set_storage_state',
    'browser_storage_state',
  ],
  testing: [
    'browser_generate_locator',
    'browser_verify_element_visible',
    'browser_verify_list_visible',
    'browser_verify_text_visible',
    'browser_verify_value',
  ],
  vision: [
    'browser_mouse_click_xy',
    'browser_mouse_down',
    'browser_mouse_drag_xy',
    'browser_mouse_move_xy',
    'browser_mouse_up',
    'browser_mouse_wheel',
  ],
  pdf: ['browser_pdf_save'],
  devtools: [
    'browser_annotate',
    'browser_hide_highlight',
    'browser_highlight',
    'browser_resume',
    'browser_start_recording',
    'browser_start_tracing',
    'browser_start_video',
    'browser_stop_recording',
    'browser_stop_tracing',
    'browser_stop_video',
    'browser_video_chapter',
    'browser_video_hide_actions',
    'browser_video_show_actions',
  ],
  config: ['browser_get_config'],
} as const;

/**
 * Connects an MCP client to a fresh Playwright MCP server over stdio. Headless, so it runs in CI;
 * `extraArgs` replace the config (for example `['--caps', 'pdf']`) when given `config: false`.
 */
export async function connectPlaywrightMcp(
  options: { config?: boolean; extraArgs?: string[]; env?: Record<string, string> } = {},
): Promise<Client> {
  const args = [CLI, '--headless'];
  if (options.config !== false) args.push('--config', CONFIG);
  args.push(...(options.extraArgs ?? []));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    cwd: REPO_ROOT,
    env: { ...(process.env as Record<string, string>), ...options.env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'aiqa-tests', version: '0.1.0' });
  await client.connect(transport);
  return client;
}
