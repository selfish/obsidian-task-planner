import { Logger } from "../types/logger";

export interface TimedOperationDeps {
  logger: Logger;
}

export class TimedOperation {
  constructor(
    private deps: TimedOperationDeps,
    private timerName: string
  ) {}

  time(name: string, operation: () => void): void {
    const start = Date.now();
    operation();
    const end = Date.now();
    this.deps.logger.debug(`${this.timerName}.${name} took ${end - start}ms`);
  }
}
