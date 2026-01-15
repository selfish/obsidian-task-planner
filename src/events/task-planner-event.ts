export type EventHandler<T> = (evtDetails: T) => Promise<void>;

export class TaskPlannerEvent<T> {
  private handlers: EventHandler<T>[] = [];

  constructor(handler?: EventHandler<T>) {
    if (handler) {
      this.listen(handler);
    }
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

  async fireAsync(evtDetails: T): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        handler(evtDetails).catch(() => {
          // Silently catch handler errors - Obsidian plugins should not use console
        })
      )
    );
  }
}
