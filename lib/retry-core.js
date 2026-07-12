'use strict';

/**
 * Shared pure retry logic (CommonJS). Loaded by both CJS and ESM entry points.
 */

/**
 * @typedef {object} RetryOptions
 * @property {number} [retries=3] Max number of retries after the first attempt (total attempts = retries + 1).
 * @property {number} [minTimeout=1000] Base delay in ms before the first retry.
 * @property {number} [maxTimeout=30000] Cap on delay in ms.
 * @property {number} [factor=2] Multiplier applied each attempt (exponential).
 * @property {boolean} [randomize=true] When true, multiplies delay by a random factor in [1, 2).
 * @property {(error: unknown, attempt: number) => boolean | Promise<boolean>} [shouldRetry] Return false to stop retrying.
 * @property {(error: unknown, attempt: number, delay: number) => void | Promise<void>} [onRetry] Called before each wait.
 * @property {AbortSignal} [signal] Abort mid-flight attempts and sleeps.
 */

/**
 * Sleep for `ms` milliseconds. Rejects if `signal` aborts.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  if (signal && signal.aborted) {
    return Promise.reject(abortError(signal));
  }
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, Math.max(0, ms));

    function onAbort() {
      clearTimeout(id);
      signal.removeEventListener('abort', onAbort);
      reject(abortError(signal));
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Compute delay (ms) for a given 0-based retry attempt index.
 * attempt 0 => first retry after the initial failure.
 * @param {number} attempt 0-based retry index
 * @param {Pick<RetryOptions, 'minTimeout' | 'maxTimeout' | 'factor' | 'randomize'>} [options]
 * @returns {number}
 */
function computeDelay(attempt, options) {
  const minTimeout = options && options.minTimeout != null ? options.minTimeout : 1000;
  const maxTimeout = options && options.maxTimeout != null ? options.maxTimeout : 30000;
  const factor = options && options.factor != null ? options.factor : 2;
  const randomize = options && options.randomize != null ? options.randomize : true;

  const exp = Math.max(0, attempt);
  let delay = minTimeout * Math.pow(factor, exp);
  if (randomize) {
    delay = delay * (1 + Math.random());
  }
  return Math.min(maxTimeout, Math.floor(delay));
}

/**
 * Retry an async (or sync-throwing) function with exponential backoff.
 * @template T
 * @param {() => T | Promise<T>} fn
 * @param {RetryOptions} [options]
 * @returns {Promise<T>}
 */
async function retry(fn, options) {
  if (typeof fn !== 'function') {
    throw new TypeError('Expected a function');
  }

  const opts = options || {};
  const retries = opts.retries != null ? opts.retries : 3;
  const signal = opts.signal;

  if (retries < 0 || !Number.isFinite(retries)) {
    throw new TypeError('retries must be a non-negative finite number');
  }

  let lastError;
  const maxAttempts = retries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal && signal.aborted) {
      throw abortError(signal);
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt >= retries;
      if (isLast) {
        break;
      }

      if (typeof opts.shouldRetry === 'function') {
        const ok = await opts.shouldRetry(err, attempt + 1);
        if (!ok) {
          break;
        }
      }

      const delay = computeDelay(attempt, opts);

      if (typeof opts.onRetry === 'function') {
        await opts.onRetry(err, attempt + 1, delay);
      }

      await sleep(delay, signal);
    }
  }

  throw lastError;
}

/**
 * @param {AbortSignal} [signal]
 * @returns {Error}
 */
function abortError(signal) {
  const reason = signal && 'reason' in signal ? signal.reason : undefined;
  if (reason instanceof Error) {
    return reason;
  }
  const err = new Error(reason != null ? String(reason) : 'This operation was aborted');
  err.name = 'AbortError';
  return err;
}

module.exports = {
  retry,
  sleep,
  computeDelay,
};
