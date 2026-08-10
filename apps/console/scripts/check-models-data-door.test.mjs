// SOURCING: none. Deliberate-failure oracle for the Models data-door gate.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertModelsDataDoorSources,
  scanModelsDataDoorSource,
} from './check-models-data-door.mjs';

describe('Models data-door gate', () => {
  it('accepts consumer GraphQL transport references', () => {
    assert.deepEqual(
      scanModelsDataDoorSource(
        'src/lib/server/observed-model-harness.ts',
        "import { executeConsumerGraphql } from './consumer-graphql-client';",
      ),
      [],
    );
  });

  it('fails on a deliberate agent-door import', () => {
    assert.throws(
      () => assertModelsDataDoorSources([{
        path: 'src/app/api/observed-model/route.ts',
        source: "import { callHarnessMcp } from '@/lib/server/harness-mcp';",
      }]),
      /route\.ts:1 references (callHarnessMcp|harness-mcp)/,
    );
  });

  it('fails when the transport boundary targets an MCP endpoint directly', () => {
    assert.throws(
      () => assertModelsDataDoorSources([{
        path: 'src/lib/server/consumer-graphql-client.ts',
        source: "await fetch('https://agent.example/mcp');",
      }]),
      /consumer-graphql-client\.ts:1 references \/mcp/,
    );
  });
});
