import { describe, expect, it } from 'vitest';
import type {
  ProcessLiveness,
  ProgramRunEvent,
  ProgramRunEventKind,
} from '@commonplace/program-contracts';
import { applyRunEvent } from './liveness';

function runEvent(
  nodeId: string,
  kind: ProgramRunEventKind,
  liveness: ProcessLiveness | null = null,
): ProgramRunEvent {
  return {
    sequence: 1,
    node_id: nodeId,
    kind,
    status: null,
    cached: false,
    liveness,
    refusal_code: null,
    message: null,
    value: null,
    drained_through_sequence: null,
  };
}

describe('applyRunEvent', () => {
  it('prefers server-authored liveness over the visual fallback', () => {
    expect(applyRunEvent({}, runEvent('node', 'node_started', 'verifying')))
      .toEqual({ node: 'verifying' });
  });

  it('maps the generated event vocabulary when liveness is absent', () => {
    expect(applyRunEvent({}, runEvent('a', 'node_started'))).toEqual({ a: 'running' });
    expect(applyRunEvent({ a: 'running' }, runEvent('a', 'node_output_chunk'))).toEqual({
      a: 'running',
    });
    expect(applyRunEvent({ a: 'running' }, runEvent('a', 'node_verifying'))).toEqual({
      a: 'verifying',
    });
    expect(applyRunEvent({ a: 'verifying' }, runEvent('a', 'node_finished'))).toEqual({
      a: 'dormant',
    });
    expect(applyRunEvent({}, runEvent('b', 'execution_cached'))).toEqual({ b: 'dormant' });
    expect(applyRunEvent({}, runEvent('c', 'node_refused'))).toEqual({ c: 'refused' });
  });
});
