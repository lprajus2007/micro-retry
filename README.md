# micro-retry

**Tiny zero-dependency async retry with exponential backoff and jitter.**

Promise-friendly. AbortSignal-aware. Works with CommonJS and ESM on Node 14+.

```bash
# GitHub Packages (requires auth for the @lprajus2007 scope — see Install notes)
npm install @lprajus2007/micro-retry

# Or install straight from the GitHub repo (no registry config):
npm install github:lprajus2007/micro-retry
```

### GitHub Packages registry config

```bash
# ~/.npmrc (or project .npmrc)
@lprajus2007:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Token needs `read:packages` (and `write:packages` to publish).

## Why

Network and API calls fail. You need a few lines to retry with backoff — without pulling in a large toolkit. `micro-retry` is pure JS, no runtime dependencies, dual CJS/ESM.

## Usage

```js
const { retry } = require('@lprajus2007/micro-retry');
// or: import { retry } from '@lprajus2007/micro-retry';

const data = await retry(
  async () => {
    const res = await fetch('https://api.example.com/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  {
    retries: 5,
    minTimeout: 200,
    maxTimeout: 5000,
    factor: 2,
    randomize: true,
    onRetry: (err, attempt, delay) => {
      console.warn(`attempt ${attempt} failed, waiting ${delay}ms`, err.message);
    },
  }
);
```

### Abort mid-flight

```js
const controller = new AbortController();
setTimeout(() => controller.abort(), 2000);

await retry(doWork, { retries: 10, minTimeout: 100, signal: controller.signal });
```

### Conditional retry

```js
await retry(doWork, {
  retries: 4,
  shouldRetry: (err) => err && err.status !== 404,
});
```

## API

| Export | Signature | Description |
|--------|-----------|-------------|
| `retry` | `(fn, options?) => Promise<T>` | Run `fn` until it succeeds or retries are exhausted |
| `sleep` | `(ms, signal?) => Promise<void>` | Promise-based delay; aborts with `signal` |
| `computeDelay` | `(attempt, options?) => number` | Delay (ms) for 0-based retry index |

### `retry(fn, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `retries` | `3` | Retries after the first attempt (total attempts = `retries + 1`) |
| `minTimeout` | `1000` | Base delay (ms) before the first retry |
| `maxTimeout` | `30000` | Maximum delay (ms) |
| `factor` | `2` | Exponential multiplier |
| `randomize` | `true` | Multiply delay by a random factor in `[1, 2)` |
| `shouldRetry` | — | `(error, attempt) => boolean`; return `false` to stop |
| `onRetry` | — | `(error, attempt, delay) => void` before each wait |
| `signal` | — | `AbortSignal` to cancel attempts and sleeps |

Default export is `retry`.

## Install size

Zero runtime dependencies. Dual entry via `exports` (`require` / `import`).

## Links

- GitHub: [lprajus2007/micro-retry](https://github.com/lprajus2007/micro-retry)
- Package: [@lprajus2007/micro-retry](https://github.com/lprajus2007/micro-retry/pkgs/npm/micro-retry)
- Release: [v1.0.0](https://github.com/lprajus2007/micro-retry/releases/tag/v1.0.0)

## License

MIT © [lprajus2007](https://github.com/lprajus2007)
