export type ErrorTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export class TaskPlannerError extends Error {
  constructor(
    message: string,
    public tier: ErrorTier,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TaskPlannerError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class FileOperationError extends TaskPlannerError {
  constructor(
    message: string,
    public filePath: string,
    public operation: "read" | "write" | "delete" | "rename",
    tier: ErrorTier = "HIGH",
    context?: Record<string, unknown>
  ) {
    super(message, tier, { ...context, filePath, operation });
    this.name = "FileOperationError";
  }
}

export class ParseError extends TaskPlannerError {
  constructor(
    message: string,
    public filePath?: string,
    public lineNumber?: number,
    tier: ErrorTier = "MEDIUM",
    context?: Record<string, unknown>
  ) {
    super(message, tier, { ...context, filePath, lineNumber });
    this.name = "ParseError";
  }
}

export class SettingsSaveError extends TaskPlannerError {
  constructor(message: string, tier: ErrorTier = "HIGH", context?: Record<string, unknown>) {
    super(message, tier, context);
    this.name = "SettingsSaveError";
  }
}
