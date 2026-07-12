export interface RetryOptions {
  /** Max number of retries after the first attempt (total attempts = retries + 1). Default: 3 */
  retries?: number;
  /** Base delay in ms before the first retry. Default: 1000 */
  minTimeout?: number;
  /** Cap on delay in ms. Default: 30000 */
  maxTimeout?: number;
  /** Multiplier applied each attempt (exponential). Default: 2 */
  factor?: number;
  /** When true, multiplies delay by a random factor in [1, 2). Default: true */
  randomize?: boolean;
  /** Return false to stop retrying. Receives the error and 1-based attempt number. */
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  /** Called before each wait. Receives error, 1-based attempt, and delay ms. */
  onRetry?: (error: unknown, attempt: number, delay: number) => void | Promise<void>;
  /** Abort mid-flight attempts and sleeps. */
  signal?: AbortSignal;
}

/**
 * Retry an async (or sync-throwing) function with exponential backoff.
 */
export function retry<T>(fn: () => T | Promise<T>, options?: RetryOptions): Promise<T>;

/**
 * Sleep for `ms` milliseconds. Rejects if `signal` aborts.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void>;

/**
 * Compute delay (ms) for a given 0-based retry attempt index.
 */
export function computeDelay(
  attempt: number,
  options?: Pick<RetryOptions, 'minTimeout' | 'maxTimeout' | 'factor' | 'randomize'>
): number;

export default retry;
