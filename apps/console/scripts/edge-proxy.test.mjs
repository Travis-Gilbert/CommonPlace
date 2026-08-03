// SOURCING: none. Unit oracle for /IDE path strip and upstream derivation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveIdeUpstream,
  stripIdePath,
} from './edge-proxy.mjs';

describe('edge-proxy path helpers', () => {
  it('strips /IDE to root for code-server', () => {
    assert.equal(stripIdePath('/IDE'), '/');
    assert.equal(stripIdePath('/IDE/'), '/');
    assert.equal(stripIdePath('/IDE/stable-123/static/out/vs.js'), '/stable-123/static/out/vs.js');
    assert.equal(stripIdePath('/IDE/?folder=/workspace/repo'), '/?folder=/workspace/repo');
  });

  it('derives IDE upstream from the chat workspace URL', () => {
    assert.equal(
      resolveIdeUpstream({
        CONSOLE_WORKSPACE_URL: 'http://commonplace-workspace.railway.internal:8787',
      }),
      'http://commonplace-workspace.railway.internal:8080',
    );
    assert.equal(
      resolveIdeUpstream({
        CONSOLE_IDE_WORKSPACE_URL: 'http://ide.example:9090/',
        CONSOLE_WORKSPACE_URL: 'http://ignored:8787',
      }),
      'http://ide.example:9090',
    );
  });
});
