import { Logger } from "../types/logger";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * No-op logger implementation.
 * Obsidian plugins should not use console logging.
 * This implementation satisfies the Logger interface without producing output.
 */
export class ConsoleLogger implements Logger {
  constructor(_logLevel: LogLevel) {}

  debug(_msg: string): void {
    // No-op: Obsidian plugins should not use console
  }

  info(_msg: string): void {
    // No-op: Obsidian plugins should not use console
  }

  warn(_msg: string): void {
    // No-op: Obsidian plugins should not use console
  }

  error(_msg: string): void {
    // No-op: Obsidian plugins should not use console
  }
}
