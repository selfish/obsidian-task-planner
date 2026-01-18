import { Logger } from "../types";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * No-op logger implementation.
 * Obsidian plugins should not use console logging in production.
 * All methods intentionally do nothing.
 */
export class ConsoleLogger implements Logger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op
  constructor(_logLevel: LogLevel) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op
  debug(_msg: string, _context?: Record<string, unknown>): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op
  info(_msg: string, _context?: Record<string, unknown>): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op
  warn(_msg: string, _context?: Record<string, unknown>): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op
  error(_error: Error | string, _context?: Record<string, unknown>): void {}
}
