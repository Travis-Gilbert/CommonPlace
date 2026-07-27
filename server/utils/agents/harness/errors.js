"use strict";

class HarnessBridgeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "HarnessBridgeError";
    this.code = code;
    if (options.details !== undefined) this.details = options.details;
  }
}

function harnessError(code, message, options = {}) {
  return new HarnessBridgeError(code, message, options);
}

module.exports = { HarnessBridgeError, harnessError };
