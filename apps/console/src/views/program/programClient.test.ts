import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dropBindingPreset,
  fetchBindingPresets,
  fetchProgramSpill,
} from './programClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProgramSpill', () => {
  it('follows every continuation and returns the complete UTF-8 result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fetch_handle: 'spill:one',
        offset: 0,
        next_offset: 3,
        total_bytes: 6,
        text: 'abc',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fetch_handle: 'spill:one',
        offset: 3,
        next_offset: null,
        total_bytes: 6,
        text: 'def',
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProgramSpill('spill:one')).resolves.toEqual({
      fetch_handle: 'spill:one',
      offset: 0,
      next_offset: null,
      total_bytes: 6,
      text: 'abcdef',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/harness/tool-result', expect.objectContaining({
      body: JSON.stringify({ fetchHandle: 'spill:one', offset: 3 }),
    }));
  });

  it('refuses a non-advancing continuation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      fetch_handle: 'spill:loop',
      offset: 0,
      next_offset: 0,
      total_bytes: 3,
      text: '',
    }))));

    await expect(fetchProgramSpill('spill:loop')).rejects.toThrow(
      'tool_result_fetch_invalid_continuation',
    );
  });
});

describe('binding station client', () => {
  it('loads sealed and transparent presets through one query', async () => {
    const presets = [
      {
        preset_id: 'preset:system',
        display_name: 'Pair',
        binding_ref: 'composition:system',
        topology: 'pair',
        capability_pack: ['theorem.peer-stations.v1'],
        budget_units: 200,
        sealed: true,
      },
      {
        preset_id: 'preset:principal',
        display_name: 'Personal',
        binding_ref: 'composition:principal',
        topology: 'pair',
        capability_pack: ['theorem.peer-stations.v1'],
        budget_units: 200,
        sealed: false,
        owner_principal_id: 'principal:owner',
        roster: [],
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      result: { presets },
    })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBindingPresets()).resolves.toEqual(presets);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/harness/programmable-graph',
      expect.objectContaining({
        body: JSON.stringify({ tool: 'programmable_graph', action: 'binding_presets', args: {} }),
      }),
    );
  });

  it('sends only the constrained station drop contract', async () => {
    const receipt = {
      program_id: 'program-draft:one',
      node_id: 'node:one',
      station: {
        preset_id: 'preset:pair',
        binding_ref: 'composition:pair',
        capability_pack: ['theorem.peer-stations.v1'],
        budget_units: 200,
        topology: 'peer',
        compiled_topology: 'pair',
        sealed: true,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      result: { receipt },
    })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(dropBindingPreset({
      programId: 'program-draft:one',
      nodeId: 'node:one',
      presetId: 'preset:pair',
      requestedTopology: 'peer',
    })).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/harness/programmable-graph',
      expect.objectContaining({
        body: JSON.stringify({
          tool: 'programmable_graph_apply',
          action: 'drop_binding_preset',
          args: {
            drop: {
              program_id: 'program-draft:one',
              node_id: 'node:one',
              preset_id: 'preset:pair',
              requested_topology: 'peer',
            },
          },
        }),
      }),
    );
  });
});
