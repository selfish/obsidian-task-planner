import { withRetry, saveSettingsWithRetry, RetryOptions } from '../../src/lib/settings-utils';
import { SettingsSaveError } from '../../src/lib/errors';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withRetry(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('success');

    const promise = withRetry(operation, { initialDelayMs: 100 });

    // First call fails immediately
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    // Advance timers to trigger retry
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should retry up to maxAttempts times and then throw', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

    let thrownError: Error | null = null;
    const promise = withRetry(operation, { maxAttempts: 3, initialDelayMs: 100 })
      .catch((err) => { thrownError = err; });

    // Let all retries happen
    await jest.advanceTimersByTimeAsync(500);
    await promise;

    expect(thrownError).toBeInstanceOf(SettingsSaveError);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw SettingsSaveError with correct message after all retries fail', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));

    let thrownError: SettingsSaveError | null = null;
    const promise = withRetry(operation, { maxAttempts: 2, initialDelayMs: 50 })
      .catch((err) => { thrownError = err; });

    await jest.advanceTimersByTimeAsync(200);
    await promise;

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toMatch(/Operation failed after 2 attempts/);
    expect(thrownError!.message).toMatch(/Persistent error/);
  });

  it('should include last error message in thrown error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Specific error message'));

    let thrownError: SettingsSaveError | null = null;
    const promise = withRetry(operation, { maxAttempts: 1 })
      .catch((err) => { thrownError = err; });

    await promise;

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toMatch(/Specific error message/);
  });

  it('should use exponential backoff', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce('success');

    const options: RetryOptions = {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    };

    const promise = withRetry(operation, options);

    // First attempt happens immediately
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    // After 100ms (first delay)
    await jest.advanceTimersByTimeAsync(100);
    expect(operation).toHaveBeenCalledTimes(2);

    // After 200ms more (second delay = 100 * 2)
    await jest.advanceTimersByTimeAsync(200);
    expect(operation).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('success');
  });

  it('should use default options when not provided', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail'));

    let thrownError: Error | null = null;
    const promise = withRetry(operation)
      .catch((err) => { thrownError = err; });

    // Run all timers to completion
    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    // Default maxAttempts is 3
    expect(thrownError).not.toBeNull();
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should handle non-Error rejections', async () => {
    const operation = jest.fn().mockRejectedValue('string error');

    let thrownError: SettingsSaveError | null = null;
    const promise = withRetry(operation, { maxAttempts: 1 })
      .catch((err) => { thrownError = err; });

    await promise;

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toMatch(/string error/);
  });

  it('should work with generic return types', async () => {
    const operation = jest.fn().mockResolvedValue({ data: [1, 2, 3] });

    const result = await withRetry<{ data: number[] }>(operation);

    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('should throw with undefined lastError when maxAttempts is 0', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    let thrownError: SettingsSaveError | null = null;
    await withRetry(operation, { maxAttempts: 0 })
      .catch((err) => { thrownError = err; });

    // With maxAttempts of 0, the loop never runs, so lastError is undefined
    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toMatch(/Operation failed after 0 attempts: undefined/);
    expect(operation).not.toHaveBeenCalled();
  });

  it('should not delay after the last attempt', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Fail'));

    let thrownError: Error | null = null;
    const promise = withRetry(operation, { maxAttempts: 2, initialDelayMs: 100 })
      .catch((err) => { thrownError = err; });

    // Let first call happen
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    // Advance to trigger second attempt
    await jest.advanceTimersByTimeAsync(100);
    expect(operation).toHaveBeenCalledTimes(2);

    await promise;

    // Promise should reject after second attempt without additional delay
    expect(thrownError).not.toBeNull();
  });
});

describe('saveSettingsWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call the save operation', async () => {
    const saveOperation = jest.fn().mockResolvedValue(undefined);

    await saveSettingsWithRetry(saveOperation);

    expect(saveOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry failed save operations', async () => {
    const saveOperation = jest.fn()
      .mockRejectedValueOnce(new Error('Save failed'))
      .mockResolvedValueOnce(undefined);

    const promise = saveSettingsWithRetry(saveOperation, { initialDelayMs: 50 });

    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(saveOperation).toHaveBeenCalledTimes(2);
  });

  it('should pass options to withRetry', async () => {
    const saveOperation = jest.fn().mockRejectedValue(new Error('Fail'));

    let thrownError: Error | null = null;
    const promise = saveSettingsWithRetry(saveOperation, { maxAttempts: 5, initialDelayMs: 10 })
      .catch((err) => { thrownError = err; });

    await jest.advanceTimersByTimeAsync(500);
    await promise;

    expect(thrownError).not.toBeNull();
    expect(saveOperation).toHaveBeenCalledTimes(5);
  });

  it('should resolve to void on success', async () => {
    const saveOperation = jest.fn().mockResolvedValue(undefined);

    const result = await saveSettingsWithRetry(saveOperation);

    expect(result).toBeUndefined();
  });
});
