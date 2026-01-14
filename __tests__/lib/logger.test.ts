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

  describe('with DEBUG log level', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Task Planner][DEBUG]')
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Task Planner][INFO]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log warn messages', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Task Planner][WARN]')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warn message')
      );
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Task Planner][ERROR]')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should include timestamp in messages', () => {
      logger.debug('Test');
      // Time format should be something like "12:34:56"
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{1,2}:\d{2}:\d{2}/)
      );
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

    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
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

    it('should log warn messages', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
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

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
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
