import { Logger } from "../types";

export type EventHandler<T> = (evtDetails: T) => Promise<void>;

export interface TaskPlannerEventDeps {
  logger?: Logger;
}

export class TaskPlannerEvent<T> {
  private handlers: EventHandler<T>[] = [];
  private logger?: Logger;

  constructor(handler?: EventHandler<T>, deps?: TaskPlannerEventDeps) {
    if (handler) {
      this.listen(handler);
    }
    this.logger = deps?.logger;
  }

  listen(handler: EventHandler<T>): () => void {
    this.handlers.push(handler);

    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  async fire(evtDetails: T): Promise<void> {
    const results = await Promise.allSettled(
      this.handlers.map((handler) => handler(evtDetails))
    );

    // Log any failures instead of silently swallowing them
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const error = result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
        this.logger?.error(error, {
          handlerIndex: i,
          eventDetails: evtDetails,
        });
      }
    }
  }
}
