import {
  TaskPlannerError,
  FileOperationError,
  ParseError,
  SettingsSaveError,
  ErrorTier,
} from '../../src/lib/errors';

describe('TaskPlannerError', () => {
  it('should create an error with message and tier', () => {
    const error = new TaskPlannerError('Test error', 'HIGH');

    expect(error.message).toBe('Test error');
    expect(error.tier).toBe('HIGH');
    expect(error.name).toBe('TaskPlannerError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TaskPlannerError);
  });

  it('should accept optional context', () => {
    const context = { userId: 123, action: 'save' };
    const error = new TaskPlannerError('Test error', 'MEDIUM', context);

    expect(error.context).toEqual(context);
  });

  it('should work without context', () => {
    const error = new TaskPlannerError('Test error', 'LOW');

    expect(error.context).toBeUndefined();
  });

  it('should support all error tiers', () => {
    const tiers: ErrorTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    tiers.forEach((tier) => {
      const error = new TaskPlannerError(`${tier} error`, tier);
      expect(error.tier).toBe(tier);
    });
  });

  it('should have proper stack trace', () => {
    const error = new TaskPlannerError('Test error', 'HIGH');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('TaskPlannerError');
  });

  it('should handle environments without Error.captureStackTrace', () => {
    // Save the original
    const originalCaptureStackTrace = Error.captureStackTrace;

    // Temporarily remove captureStackTrace to simulate non-V8 environment
    // @ts-expect-error - intentionally setting to undefined for testing
    Error.captureStackTrace = undefined;

    try {
      const error = new TaskPlannerError('Test error', 'HIGH');
      // Error should still be created successfully
      expect(error.message).toBe('Test error');
      expect(error.tier).toBe('HIGH');
    } finally {
      // Restore the original
      Error.captureStackTrace = originalCaptureStackTrace;
    }
  });
});

describe('FileOperationError', () => {
  it('should create an error with file path and operation', () => {
    const error = new FileOperationError(
      'Failed to read file',
      '/path/to/file.md',
      'read'
    );

    expect(error.message).toBe('Failed to read file');
    expect(error.filePath).toBe('/path/to/file.md');
    expect(error.operation).toBe('read');
    expect(error.name).toBe('FileOperationError');
    expect(error.tier).toBe('HIGH'); // default tier
  });

  it('should include filePath and operation in context', () => {
    const error = new FileOperationError(
      'Failed to write',
      '/path/to/file.md',
      'write'
    );

    expect(error.context).toMatchObject({
      filePath: '/path/to/file.md',
      operation: 'write',
    });
  });

  it('should accept custom tier', () => {
    const error = new FileOperationError(
      'Failed to delete',
      '/path/to/file.md',
      'delete',
      'CRITICAL'
    );

    expect(error.tier).toBe('CRITICAL');
  });

  it('should merge additional context with file info', () => {
    const error = new FileOperationError(
      'Failed to rename',
      '/path/to/file.md',
      'rename',
      'MEDIUM',
      { newPath: '/path/to/new.md', attempt: 3 }
    );

    expect(error.context).toMatchObject({
      filePath: '/path/to/file.md',
      operation: 'rename',
      newPath: '/path/to/new.md',
      attempt: 3,
    });
  });

  it('should support all operation types', () => {
    const operations: Array<'read' | 'write' | 'delete' | 'rename'> = [
      'read',
      'write',
      'delete',
      'rename',
    ];

    operations.forEach((op) => {
      const error = new FileOperationError(`Failed ${op}`, '/file.md', op);
      expect(error.operation).toBe(op);
    });
  });

  it('should be instanceof TaskPlannerError', () => {
    const error = new FileOperationError('Error', '/file.md', 'read');

    expect(error).toBeInstanceOf(TaskPlannerError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ParseError', () => {
  it('should create an error with message only', () => {
    const error = new ParseError('Invalid syntax');

    expect(error.message).toBe('Invalid syntax');
    expect(error.name).toBe('ParseError');
    expect(error.tier).toBe('MEDIUM'); // default tier
    expect(error.filePath).toBeUndefined();
    expect(error.lineNumber).toBeUndefined();
  });

  it('should accept file path and line number', () => {
    const error = new ParseError(
      'Unexpected token',
      '/path/to/file.md',
      42
    );

    expect(error.filePath).toBe('/path/to/file.md');
    expect(error.lineNumber).toBe(42);
  });

  it('should include filePath and lineNumber in context', () => {
    const error = new ParseError('Error', '/file.md', 10);

    expect(error.context).toMatchObject({
      filePath: '/file.md',
      lineNumber: 10,
    });
  });

  it('should accept custom tier', () => {
    const error = new ParseError(
      'Critical parse failure',
      '/file.md',
      1,
      'CRITICAL'
    );

    expect(error.tier).toBe('CRITICAL');
  });

  it('should merge additional context', () => {
    const error = new ParseError(
      'Parse error',
      '/file.md',
      5,
      'LOW',
      { token: '{', expected: '}' }
    );

    expect(error.context).toMatchObject({
      filePath: '/file.md',
      lineNumber: 5,
      token: '{',
      expected: '}',
    });
  });

  it('should be instanceof TaskPlannerError', () => {
    const error = new ParseError('Error');

    expect(error).toBeInstanceOf(TaskPlannerError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('SettingsSaveError', () => {
  it('should create an error with message', () => {
    const error = new SettingsSaveError('Failed to save settings');

    expect(error.message).toBe('Failed to save settings');
    expect(error.name).toBe('SettingsSaveError');
    expect(error.tier).toBe('HIGH'); // default tier
  });

  it('should accept custom tier', () => {
    const error = new SettingsSaveError('Settings corrupted', 'CRITICAL');

    expect(error.tier).toBe('CRITICAL');
  });

  it('should accept context', () => {
    const error = new SettingsSaveError(
      'Save failed',
      'HIGH',
      { settingsKey: 'theme', retryCount: 3 }
    );

    expect(error.context).toEqual({
      settingsKey: 'theme',
      retryCount: 3,
    });
  });

  it('should be instanceof TaskPlannerError', () => {
    const error = new SettingsSaveError('Error');

    expect(error).toBeInstanceOf(TaskPlannerError);
    expect(error).toBeInstanceOf(Error);
  });
});
