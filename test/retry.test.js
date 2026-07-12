'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Drive the SHIPPED package entry (package root), not a reimplemented copy.
const pkgRoot = path.join(__dirname, '..');
const { retry, sleep, computeDelay } = require(pkgRoot);

describe('package entry (require package root)', () => {
  it('exports retry, sleep, computeDelay as functions', () => {
    assert.equal(typeof retry, 'function');
    assert.equal(typeof sleep, 'function');
    assert.equal(typeof computeDelay, 'function');
  });
});

describe('computeDelay', () => {
  it('returns minTimeout when attempt is 0 and randomize is false', () => {
    const d = computeDelay(0, {
      minTimeout: 100,
      maxTimeout: 10000,
      factor: 2,
      randomize: false,
    });
    assert.equal(d, 100);
  });

  it('grows exponentially with factor when randomize is false', () => {
    const opts = { minTimeout: 50, maxTimeout: 100000, factor: 2, randomize: false };
    assert.equal(computeDelay(0, opts), 50);
    assert.equal(computeDelay(1, opts), 100);
    assert.equal(computeDelay(2, opts), 200);
    assert.equal(computeDelay(3, opts), 400);
  });

  it('caps at maxTimeout', () => {
    const d = computeDelay(10, {
      minTimeout: 1000,
      maxTimeout: 2500,
      factor: 2,
      randomize: false,
    });
    assert.equal(d, 2500);
  });

  it('with randomize true stays in [min, 2*min) for attempt 0 before cap', () => {
    const samples = [];
    for (let i = 0; i < 40; i++) {
      samples.push(
        computeDelay(0, {
          minTimeout: 100,
          maxTimeout: 100000,
          factor: 2,
          randomize: true,
        })
      );
    }
    for (const d of samples) {
      assert.ok(d >= 100, `delay ${d} should be >= 100`);
      assert.ok(d < 200, `delay ${d} should be < 200`);
    }
  });
});

describe('sleep', () => {
  it('resolves after approximately the requested duration', async () => {
    const start = Date.now();
    await sleep(40);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 30, `elapsed ${elapsed}ms should be >= 30`);
  });

  it('rejects when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => sleep(1000, controller.signal), (err) => {
      assert.ok(err);
      return true;
    });
  });

  it('rejects when signal aborts during sleep', async () => {
    const controller = new AbortController();
    const p = sleep(5000, controller.signal);
    controller.abort();
    await assert.rejects(() => p, (err) => {
      assert.equal(err.name, 'AbortError');
      return true;
    });
  });
});

describe('retry', () => {
  it('returns the value when fn succeeds on first try', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls += 1;
      return 'ok';
    }, { retries: 2, minTimeout: 1, randomize: false });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('retries until success and returns the eventual value', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`fail-${calls}`);
        return { n: calls };
      },
      { retries: 5, minTimeout: 1, maxTimeout: 5, factor: 1, randomize: false }
    );
    assert.deepEqual(result, { n: 3 });
    assert.equal(calls, 3);
  });

  it('throws the last error after exhausting retries', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            calls += 1;
            throw new Error(`e${calls}`);
          },
          { retries: 2, minTimeout: 1, maxTimeout: 5, factor: 1, randomize: false }
        ),
      (err) => {
        assert.equal(err.message, 'e3');
        return true;
      }
    );
    // first attempt + 2 retries = 3
    assert.equal(calls, 3);
  });

  it('invokes onRetry with attempt and delay before waiting', async () => {
    const events = [];
    let calls = 0;
    await retry(
      async () => {
        calls += 1;
        if (calls < 2) throw new Error('once');
        return true;
      },
      {
        retries: 3,
        minTimeout: 10,
        maxTimeout: 10,
        factor: 1,
        randomize: false,
        onRetry: (err, attempt, delay) => {
          events.push({ message: err.message, attempt, delay });
        },
      }
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].message, 'once');
    assert.equal(events[0].attempt, 1);
    assert.equal(events[0].delay, 10);
  });

  it('stops early when shouldRetry returns false', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            calls += 1;
            const e = new Error('nope');
            e.code = 'FATAL';
            throw e;
          },
          {
            retries: 5,
            minTimeout: 1,
            randomize: false,
            shouldRetry: (err) => err.code !== 'FATAL',
          }
        ),
      (err) => err.code === 'FATAL'
    );
    assert.equal(calls, 1);
  });

  it('rejects non-function fn with TypeError', async () => {
    await assert.rejects(() => retry(null), (err) => err instanceof TypeError);
  });

  it('rejects invalid retries with TypeError', async () => {
    await assert.rejects(
      () => retry(() => 1, { retries: -1 }),
      (err) => err instanceof TypeError
    );
  });

  it('aborts when signal is aborted before start', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            calls += 1;
            return 1;
          },
          { signal: controller.signal, retries: 2, minTimeout: 1 }
        ),
      (err) => err.name === 'AbortError'
    );
    assert.equal(calls, 0);
  });

  it('supports sync functions that return a value', async () => {
    const result = await retry(() => 42, { retries: 0 });
    assert.equal(result, 42);
  });

  it('supports sync functions that throw', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        retry(
          () => {
            calls += 1;
            throw new Error('sync');
          },
          { retries: 1, minTimeout: 1, maxTimeout: 2, factor: 1, randomize: false }
        ),
      (err) => err.message === 'sync'
    );
    assert.equal(calls, 2);
  });
});
