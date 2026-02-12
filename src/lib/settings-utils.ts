import { SettingsSaveError } from "./errors";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { maxAttempts, initialDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;
  let currentDelay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await delay(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw new SettingsSaveError(`Operation failed after ${maxAttempts} attempts: ${lastError?.message}`, "HIGH", { maxAttempts, lastError: lastError?.message });
}

export async function saveSettingsWithRetry(saveOperation: () => Promise<void>, options?: RetryOptions): Promise<void> {
  return withRetry(saveOperation, options);
}
