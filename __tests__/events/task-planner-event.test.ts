import { TaskPlannerEvent, EventHandler } from '../../src/events/task-planner-event';

describe('TaskPlannerEvent', () => {
  describe('constructor', () => {
    it('should create event without handler', () => {
      const event = new TaskPlannerEvent<string>();
      expect(event).toBeInstanceOf(TaskPlannerEvent);
    });

    it('should create event with initial handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const event = new TaskPlannerEvent<string>(handler);

      await event.fireAsync('test');

      expect(handler).toHaveBeenCalledWith('test');
    });
  });

  describe('listen', () => {
    it('should register a handler', async () => {
      const event = new TaskPlannerEvent<string>();
      const handler = jest.fn().mockResolvedValue(undefined);

      event.listen(handler);
      await event.fireAsync('test');

      expect(handler).toHaveBeenCalledWith('test');
    });

    it('should register multiple handlers', async () => {
      const event = new TaskPlannerEvent<number>();
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      event.listen(handler1);
      event.listen(handler2);
      await event.fireAsync(42);

      expect(handler1).toHaveBeenCalledWith(42);
      expect(handler2).toHaveBeenCalledWith(42);
    });

    it('should return unsubscribe function', async () => {
      const event = new TaskPlannerEvent<string>();
      const handler = jest.fn().mockResolvedValue(undefined);

      const unsubscribe = event.listen(handler);
      unsubscribe();
      await event.fireAsync('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only unsubscribe the specific handler', async () => {
      const event = new TaskPlannerEvent<string>();
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      const unsubscribe1 = event.listen(handler1);
      event.listen(handler2);

      unsubscribe1();
      await event.fireAsync('test');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('test');
    });
  });

  describe('fireAsync', () => {
    it('should call all handlers with event data', async () => {
      const event = new TaskPlannerEvent<{ name: string; value: number }>();
      const handler = jest.fn().mockResolvedValue(undefined);

      event.listen(handler);
      await event.fireAsync({ name: 'test', value: 123 });

      expect(handler).toHaveBeenCalledWith({ name: 'test', value: 123 });
    });

    it('should execute handlers in parallel', async () => {
      const event = new TaskPlannerEvent<string>();
      const executionOrder: number[] = [];

      const handler1: EventHandler<string> = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push(1);
      };
      const handler2: EventHandler<string> = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(2);
      };

      event.listen(handler1);
      event.listen(handler2);
      await event.fireAsync('test');

      // Handler 2 should complete first since it has shorter delay
      expect(executionOrder).toEqual([2, 1]);
    });

    it('should catch errors from handlers silently and continue', async () => {
      const event = new TaskPlannerEvent<string>();

      const failingHandler: EventHandler<string> = async () => {
        throw new Error('Handler error');
      };
      const successHandler = jest.fn().mockResolvedValue(undefined);

      event.listen(failingHandler);
      event.listen(successHandler);

      // Should not throw and should still call the success handler
      await event.fireAsync('test');

      expect(successHandler).toHaveBeenCalled();
    });

    it('should work with no handlers', async () => {
      const event = new TaskPlannerEvent<string>();

      // Should not throw
      await event.fireAsync('test');
    });
  });

  describe('typed events', () => {
    it('should work with complex types', async () => {
      interface ComplexData {
        items: string[];
        metadata: {
          count: number;
          timestamp: Date;
        };
      }

      const event = new TaskPlannerEvent<ComplexData>();
      const handler = jest.fn().mockResolvedValue(undefined);

      event.listen(handler);

      const testData: ComplexData = {
        items: ['a', 'b', 'c'],
        metadata: {
          count: 3,
          timestamp: new Date(),
        },
      };

      await event.fireAsync(testData);

      expect(handler).toHaveBeenCalledWith(testData);
    });

    it('should work with array types', async () => {
      const event = new TaskPlannerEvent<number[]>();
      const handler = jest.fn().mockResolvedValue(undefined);

      event.listen(handler);
      await event.fireAsync([1, 2, 3, 4, 5]);

      expect(handler).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
    });

    it('should work with undefined/null values', async () => {
      const event = new TaskPlannerEvent<string | null>();
      const handler = jest.fn().mockResolvedValue(undefined);

      event.listen(handler);
      await event.fireAsync(null);

      expect(handler).toHaveBeenCalledWith(null);
    });
  });
});
