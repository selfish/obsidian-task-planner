import { TimedOperation, TimedOperationDeps } from '../../src/lib/timed-operation';
import { Logger } from '../../src/types/logger';

const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('TimedOperation', () => {
  let mockLogger: Logger;
  let deps: TimedOperationDeps;

  beforeEach(() => {
    mockLogger = createMockLogger();
    deps = { logger: mockLogger };
  });

  describe('constructor', () => {
    it('should create a timed operation with a timer name', () => {
      const op = new TimedOperation(deps, 'TestTimer');
      expect(op).toBeInstanceOf(TimedOperation);
    });
  });

  describe('time', () => {
    it('should execute the operation', () => {
      const op = new TimedOperation(deps, 'TestTimer');
      let executed = false;

      op.time('operation', () => {
        executed = true;
      });

      expect(executed).toBe(true);
    });

    it('should log the operation time', () => {
      const op = new TimedOperation(deps, 'TestTimer');

      op.time('operation', () => {
        // Quick operation
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^TestTimer\.operation took \d+ms$/)
      );
    });

    it('should include timer name and operation name in log', () => {
      const op = new TimedOperation(deps, 'MyComponent');

      op.time('loadData', () => {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MyComponent.loadData')
      );
    });

    it('should measure actual execution time', async () => {
      const op = new TimedOperation(deps, 'TestTimer');

      op.time('slowOperation', () => {
        // Simulate a blocking operation
        const start = Date.now();
        while (Date.now() - start < 50) {
          // busy wait
        }
      });

      const logMessage = (mockLogger.debug as jest.Mock).mock.calls[0][0];
      const timeMatch = logMessage.match(/took (\d+)ms/);
      const measuredTime = parseInt(timeMatch[1], 10);

      expect(measuredTime).toBeGreaterThanOrEqual(50);
    });

    it('should handle operations that throw errors', () => {
      const op = new TimedOperation(deps, 'TestTimer');
      const error = new Error('Operation failed');

      expect(() => {
        op.time('failingOperation', () => {
          throw error;
        });
      }).toThrow(error);

      // Should still log even if operation throws
      // (Note: current implementation does not log on error,
      // but this test documents current behavior)
    });

    it('should handle multiple operations', () => {
      const op = new TimedOperation(deps, 'TestTimer');

      op.time('operation1', () => {});
      op.time('operation2', () => {});
      op.time('operation3', () => {});

      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('operation1'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('operation2'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('operation3'));
    });

    it('should work with different timer names', () => {
      const op1 = new TimedOperation(deps, 'Timer1');
      const op2 = new TimedOperation(deps, 'Timer2');

      op1.time('action', () => {});
      op2.time('action', () => {});

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Timer1.action'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Timer2.action'));
    });
  });
});
