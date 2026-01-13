export type eventHandler<T> = (evtDetails: T) => Promise<void>

export class PwEvent<T> {
  private handlers: eventHandler<T>[] = []

  constructor(handler: eventHandler<T> = undefined) {
    if (handler) {
      this.listen(handler)
    }
  }

  listen(handler: eventHandler<T>): () => void {
    this.handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  async fireAsync(evtDetails: T) {
    await Promise.all(this.handlers.map(handler => handler(evtDetails).catch(err => {
      console.error('[Task Horizon] Event handler error:', err);
    })))
  }
}