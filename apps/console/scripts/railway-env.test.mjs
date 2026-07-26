import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertRailwayEnvironment } from './railway-env.mjs';

describe('assertRailwayEnvironment', () => {
  it('requires the production data API URL', () => {
    assert.throws(
      () => assertRailwayEnvironment({}),
      /CONSOLE_DATA_API_URL is required/,
    );
    assert.throws(
      () => assertRailwayEnvironment({ CONSOLE_DATA_API_URL: '   ' }),
      /CONSOLE_DATA_API_URL is required/,
    );
  });

  it('accepts an explicit data API URL', () => {
    assert.doesNotThrow(() =>
      assertRailwayEnvironment({
        CONSOLE_DATA_API_URL: 'http://commonplace-api.railway.internal:8080',
      }),
    );
  });
});
