/**
 * Error tier levels for categorizing error severity
 */
export type ErrorTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Base error class for all Task Planner errors
 */
export class TaskPlannerError extends Error {
  constructor(
    message: string,
    public tier: ErrorTier,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaskPlannerError';
    // Maintains proper stack trace for where error was thrown (only in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when file operations fail (read, write, delete)
 */
export class FileOperationError extends TaskPlannerError {
  constructor(
    message: string,
    public filePath: string,
    public operation: 'read' | 'write' | 'delete' | 'rename',
    tier: ErrorTier = 'HIGH',
    context?: Record<string, unknown>
  ) {
    super(message, tier, { ...context, filePath, operation });
    this.name = 'FileOperationError';
  }
}

/**
 * Error thrown when parsing operations fail
 */
export class ParseError extends TaskPlannerError {
  constructor(
    message: string,
    public filePath?: string,
    public lineNumber?: number,
    tier: ErrorTier = 'MEDIUM',
    context?: Record<string, unknown>
  ) {
    super(message, tier, { ...context, filePath, lineNumber });
    this.name = 'ParseError';
  }
}

/**
 * Error thrown when settings save operations fail
 */
export class SettingsSaveError extends TaskPlannerError {
  constructor(
    message: string,
    tier: ErrorTier = 'HIGH',
    context?: Record<string, unknown>
  ) {
    super(message, tier, context);
    this.name = 'SettingsSaveError';
  }
}
