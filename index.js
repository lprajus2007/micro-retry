'use strict';

const { retry, sleep, computeDelay } = require('./lib/retry-core.js');

module.exports = {
  retry,
  sleep,
  computeDelay,
};
module.exports.retry = retry;
module.exports.sleep = sleep;
module.exports.computeDelay = computeDelay;
module.exports.default = retry;
