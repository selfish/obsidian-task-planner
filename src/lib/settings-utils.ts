import { SettingsSaveError } from "./errors";

/**
 * Options for retry logic
 */
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

/**
 * Delays execution for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with retry logic
 *
 * @param operation - The async operation to retry
 * @param options - Retry options
 * @returns The result of the operation
 * @throws SettingsSaveError if all retry attempts fail
 */
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

      // Don't delay after the last attempt
      if (attempt < maxAttempts) {
        await delay(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }
  }

  throw new SettingsSaveError(`Operation failed after ${maxAttempts} attempts: ${lastError?.message}`, "HIGH", { maxAttempts, lastError: lastError?.message });
}

/**
 * Wraps a settings save operation with retry logic
 *
 * @param saveOperation - The settings save function to call
 * @param options - Optional retry options
 * @returns A promise that resolves when save succeeds or rejects after all retries fail
 */
export async function saveSettingsWithRetry(saveOperation: () => Promise<void>, options?: RetryOptions): Promise<void> {
  return withRetry(saveOperation, options);
}
