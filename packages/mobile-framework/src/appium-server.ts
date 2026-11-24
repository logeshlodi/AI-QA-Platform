import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { androidEnv } from './android-sdk';
import { PACKAGE_DIR } from './config';

const KEEP = 5000;

/**
 * One Appium server per Playwright worker, on a free port, started from this package's own
 * node_modules. APPIUM_HOME is the package folder, so the drivers are exactly the ones its
 * package.json pins (no `appium driver install`, nothing global).
 */
export class AppiumServer {
  /** The last lines of the server log, and how many lines it has written in all. */
  private readonly lines: string[] = [];
  private written = 0;

  private constructor(
    private readonly child: ChildProcess,
    readonly port: number,
    readonly logFile: string,
  ) {}

  static async start(options: { logFile: string; allowInsecure?: string[] }): Promise<AppiumServer> {
    const port = await freePort();
    fs.mkdirSync(path.dirname(options.logFile), { recursive: true });
    const main = path.join(PACKAGE_DIR, 'node_modules', 'appium', 'index.js');
    const args = [main, 'server', '--address', '127.0.0.1', '--port', String(port), '--log-no-colors'];
    if (options.allowInsecure?.length) args.push('--allow-insecure', options.allowInsecure.join(','));
    const child = spawn(process.execPath, args, {
      env: { ...androidEnv(), APPIUM_HOME: PACKAGE_DIR },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const server = new AppiumServer(child, port, options.logFile);
    const log = fs.createWriteStream(options.logFile);
    const keep = (chunk: Buffer) => {
      log.write(chunk);
      const lines = chunk.toString('utf8').split(/\r?\n/).filter(Boolean);
      server.lines.push(...lines);
      server.written += lines.length;
      if (server.lines.length > KEEP) server.lines.splice(0, server.lines.length - KEEP);
    };
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);
    child.once('exit', () => log.end());
    await server.waitUntilReady();
    return server;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /** The server's last lines: attached to a failing test, next to the device log. */
  tail(count = 200): string {
    return this.lines.slice(-count).join('\n');
  }

  /** A position in the log, taken when a test starts, so its own part can be cut out later. */
  mark(): number {
    return this.written;
  }

  /** Everything logged since the mark (or as much of it as is still kept). */
  since(mark: number): string {
    const count = Math.min(this.written - mark, this.lines.length);
    return count > 0 ? this.lines.slice(-count).join('\n') : '';
  }

  private async waitUntilReady(timeoutMs = 60_000): Promise<void> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (this.child.exitCode !== null) {
        throw new Error(`Appium exited with code ${this.child.exitCode}:\n${this.tail(40)}`);
      }
      try {
        const response = await fetch(`${this.url}/status`);
        if (response.ok) return;
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Appium did not answer /status within ${timeoutMs / 1000} s:\n${this.tail(40)}`);
  }

  async stop(): Promise<void> {
    if (this.child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => this.child.once('exit', () => resolve()));
    this.child.kill('SIGTERM');
    const timer = setTimeout(() => this.child.kill('SIGKILL'), 10_000);
    await exited;
    clearTimeout(timer);
  }
}

/** A port the operating system says is free right now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port')),
      );
    });
  });
}
