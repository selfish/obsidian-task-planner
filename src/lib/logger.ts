import { Logger } from "../types";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// No-op logger - Obsidian plugins should not use console logging in production
export class ConsoleLogger implements Logger {
  constructor(_logLevel: LogLevel) {}
  debug(_msg: string, _context?: Record<string, unknown>): void {}
  info(_msg: string, _context?: Record<string, unknown>): void {}
  warn(_msg: string, _context?: Record<string, unknown>): void {}
  error(_error: Error | string, _context?: Record<string, unknown>): void {}
}
