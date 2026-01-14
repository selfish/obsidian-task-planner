/* eslint-disable no-console */
import { Logger } from "../types/logger";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class ConsoleLogger implements Logger {
  constructor(private logLevel: LogLevel) {}

  private getTime(): string {
    return new Date().toLocaleTimeString();
  }

  debug(msg: string): void {
    if (this.logLevel > LogLevel.DEBUG) return;
    console.debug(`[Task Planner][DEBUG] ${this.getTime()}: ${msg}`);
  }

  info(msg: string): void {
    if (this.logLevel > LogLevel.INFO) return;
    console.log(`[Task Planner][INFO] ${this.getTime()}: ${msg}`);
  }

  warn(msg: string): void {
    if (this.logLevel > LogLevel.WARN) return;
    console.warn(`[Task Planner][WARN] ${this.getTime()}: ${msg}`);
  }

  error(msg: string): void {
    if (this.logLevel > LogLevel.ERROR) return;
    console.error(`[Task Planner][ERROR] ${this.getTime()}: ${msg}`);
  }
}
