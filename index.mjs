import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('./lib/retry-core.js');

export const retry = core.retry;
export const sleep = core.sleep;
export const computeDelay = core.computeDelay;
export default core.retry;
