// SOURCING: none. Contract normalization tests.

import { describe, expect, it } from 'vitest';
import {
  isStatusReport,
  normalizeBootPayload,
  normalizeWhyReport,
  readStatusScope,
  readWhyTarget,
  serializeStatusScope,
} from './harness-ux';

describe('Harness UX contract helpers', () => {
  it('serializes status scopes without accepting missing ids', () => {
    expect(serializeStatusScope({ kind: 'all' })).toEqual({ kind: 'all' });
    expect(serializeStatusScope({ kind: 'run', runId: 'run:1' })).toEqual({ kind: 'run', runId: 'run:1' });
    expect(serializeStatusScope({ kind: 'room', roomId: 'room:1' })).toEqual({ kind: 'room', roomId: 'room:1' });
    expect(readStatusScope({ kind: 'run' })).toBeNull();
    expect(readStatusScope({ kind: 'room', roomId: 'room:1' })).toEqual({ kind: 'room', roomId: 'room:1' });
  });

  it('guards the status report contract and keeps honest empty arrays', () => {
    expect(isStatusReport({
      runs: [],
      waitingOnYou: [],
      coordination: { roomId: null, intents: [], unreadStreamDeltas: 0 },
      cost: { visible: false, today: null, perRun: [], priceTableVersion: null },
      degradation: { degraded: true, missing: ['status_graphql'] },
      generation: 7,
    })).toBe(true);
    expect(isStatusReport({ runs: [] })).toBe(false);
  });

  it('normalizes why reports with snake case next_call remedies', () => {
    const report = normalizeWhyReport({
      target: { kind: 'receipt', id: 'receipt:1' },
      kind: 'refusal_trace',
      trace: { rule: 'approval_required' },
      refs: [{ id: 'ref:1', label: 'Ref one' }],
      degradation: { degraded: false, missing: [] },
      refusal: {
        code: 'approval_required',
        message: 'Needs consent.',
        remedy: {
          explanation: 'Grant the missing consent.',
          missing: { kind: 'capability', value: 'github.write' },
          next_call: { surface: 'plan', arguments: { action: 'consent' } },
        },
      },
    });
    expect(report?.refusal?.remedy.nextCall).toEqual({
      surface: 'plan',
      arguments: { action: 'consent' },
    });
  });

  it('rejects unsupported why target kinds', () => {
    expect(readWhyTarget({ kind: 'proposal', id: 'proposal:1' })).toBeNull();
    expect(readWhyTarget({ kind: 'run', id: 'run:1' })).toEqual({ kind: 'run', id: 'run:1' });
  });

  it('normalizes flat boot markdown payloads without a degradation object', () => {
    const boot = normalizeBootPayload({
      tool: 'boot',
      markdown: '## Harness boot\n\nReady.\n',
      status_digest: {
        runs: [],
        waitingOnYou: [],
        degradation: { degraded: true, missing: ['standing_queries'] },
        cost: { visible: true },
      },
      truncated: false,
      generation: 0,
    });
    expect(boot?.markdown).toContain('Harness boot');
    expect(boot?.degradation.missing).toContain('status_digest_projection');
  });
});
