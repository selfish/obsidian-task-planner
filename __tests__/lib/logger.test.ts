import { ConsoleLogger, LogLevel } from '../../src/lib/logger';

describe('ConsoleLogger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });

  // Note: ConsoleLogger is a no-op implementation because Obsidian plugins
  // should not use console logging. All tests verify that no console output occurs.

  describe('with DEBUG log level', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
    });

    it('should not log debug messages (no-op)', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages (no-op)', () => {
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages (no-op)', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log error messages (no-op)', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should accept messages without throwing', () => {
      expect(() => {
        logger.debug('Test');
        logger.info('Test');
        logger.warn('Test');
        logger.error('Test');
      }).not.toThrow();
    });
  });

  describe('with INFO log level', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.INFO);
    });

    it('should not log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages (no-op)', () => {
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages (no-op)', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log error messages (no-op)', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('with WARN log level', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.WARN);
    });

    it('should not log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages', () => {
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages (no-op)', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log error messages (no-op)', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('with ERROR log level', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.ERROR);
    });

    it('should not log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages', () => {
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not log error messages (no-op)', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('with log level higher than ERROR', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      // Use a level higher than ERROR to suppress all logs
      logger = new ConsoleLogger(LogLevel.ERROR + 1);
    });

    it('should not log any messages', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
