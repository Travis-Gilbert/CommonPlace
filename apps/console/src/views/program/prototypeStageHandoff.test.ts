import { describe, expect, it } from 'vitest';
import type { ProgramDefinition, ProgramRunReceipt } from '@commonplace/program-contracts';
import {
  buildPrototypeStageProps,
  findViewNodeIds,
  isViewNodeKind,
  recordingIdFromReceipt,
  shouldOpenPrototypeStageForInterior,
} from './prototypeStageHandoff';

const definition = {
  tenant_id: 't',
  name: 'p',
  intent: 'i',
  authority: 'Advisory',
  nodes: [
    { id: 'sim', block_id: 'b', kind: { Stochastic: { affordance_id: 'physics.rigid-body' } }, ports: [] },
    { id: 'view', block_id: 'b', kind: { View: { surface_id: 'rerun' } }, ports: [] },
  ],
  edges: [],
  metadata: {},
} as unknown as ProgramDefinition;

describe('prototypeStageHandoff', () => {
  it('detects View node kinds', () => {
    expect(isViewNodeKind({ View: { surface_id: 'rerun' } })).toBe(true);
    expect(isViewNodeKind({ Stochastic: { affordance_id: 'x' } })).toBe(false);
    expect(findViewNodeIds(definition)).toEqual(['view']);
  });

  it('extracts recording_id from inspections', () => {
    const receipt = {
      inspections: {
        sim: {
          node_id: 'sim',
          outputs: {
            storage: 'inline',
            value: {
              recording_id: 'proto-rec:abc',
              blob_hash: 'sha256:x',
              assemble_expr_root: 'expr:root',
            },
          },
          pinned: false,
          stale: false,
        },
      },
      events: [],
    } as unknown as ProgramRunReceipt;
    expect(recordingIdFromReceipt(receipt)).toBe('proto-rec:abc');
  });

  it('builds stage props under config', () => {
    const props = buildPrototypeStageProps({
      recordingId: 'proto-rec:abc',
      viewNodeId: 'view',
      definition,
      pathToExpr: { '/proto/sim/box_a': 'expr:box_a' },
    });
    const config = props.config as Record<string, unknown>;
    expect(config.recording_id).toBe('proto-rec:abc');
    expect(config.view_node_id).toBe('view');
    expect((config.path_to_expr as Record<string, string>)['/proto/sim/box_a']).toBe('expr:box_a');
  });

  it('opens stage only when interior has a View', () => {
    expect(shouldOpenPrototypeStageForInterior(definition)).toEqual({
      open: true,
      viewNodeId: 'view',
    });
    const noView = {
      ...definition,
      nodes: definition.nodes.filter((node) => node.id !== 'view'),
    };
    expect(shouldOpenPrototypeStageForInterior(noView)).toEqual({ open: false });
  });
});
