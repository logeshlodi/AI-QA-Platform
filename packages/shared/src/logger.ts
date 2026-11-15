import pino, { type Logger } from 'pino';
import { loadEnv } from './env';

let root: Logger | undefined;

/** Structured JSON logger. One instance per process; children carry context. */
export function getLogger(scope?: string): Logger {
  root ??= pino({ level: loadEnv().LOG_LEVEL, base: undefined });
  return scope ? root.child({ scope }) : root;
}
