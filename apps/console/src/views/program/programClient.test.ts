import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceProgramPin,
  collapseProgramNode,
  dropBindingPreset,
  expandProgramNode,
  fetchBindingPresets,
  fetchProgramEnvironment,
  fetchProgramInterior,
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
        display_name: 'Flash + M3',
        binding_ref: 'composition:system',
        replication: 'single',
        capability_pack: ['theorem.peer-stations.v1'],
        budget_units: 200,
        sealed: true,
      },
      {
        preset_id: 'preset:principal',
        display_name: 'Personal',
        binding_ref: 'composition:principal',
        replication: 'single',
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
        preset_id: 'preset:single',
        binding_ref: 'composition:single',
        capability_pack: ['theorem.peer-stations.v1'],
        budget_units: 200,
        replication: 'peer',
        compiled_replication: 'single',
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
      presetId: 'preset:single',
      requestedReplication: 'peer',
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
              preset_id: 'preset:single',
              requested_replication: 'peer',
            },
          },
        }),
      }),
    );
  });
});


describe('compound node client', () => {
  it('expands, collapses, and advances pins through apply actions', async () => {
    const exterior = {
      tenant_id: 'tenant',
      name: 'Exterior',
      intent: '',
      authority: 'advisory',
      environment: { bindings: [] },
      trigger: { kind: 'graph_change', labels: [], properties: [] },
      budget: { max_invocations: 1, window_seconds: 1, max_cost_microunits: 1 },
      approval: { mode: 'preapproved_within_grants', grant_ids: [] },
      nodes: [],
      edges: [],
      metadata: {},
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: {
          node_id: 'program:exterior',
          content_id: 'program:content-expanded',
          exterior_program_id: 'program:content-before',
          event: { kind: 'expand_node', node_id: 'rule' },
          persisted_interiors: [{ node_id: 'program:interior', content_id: 'program:interior-content' }],
          program: exterior,
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: {
          node_id: 'program:exterior',
          content_id: 'program:content-collapsed',
          exterior_program_id: 'program:content-expanded',
          event: { kind: 'collapse_node', node_id: 'rule' },
          persisted_interiors: [],
          program: exterior,
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: {
          node_id: 'program:exterior',
          content_id: 'program:content-advanced',
          exterior_program_id: 'program:content-expanded',
          event: { kind: 'advance_pin', node_id: 'rule' },
          persisted_interiors: [],
          program: exterior,
        },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(expandProgramNode({
      programId: 'program:content-before',
      nodeId: 'rule',
    })).resolves.toMatchObject({
      content_id: 'program:content-expanded',
      persisted_interiors: [{ content_id: 'program:interior-content' }],
    });
    await expect(collapseProgramNode({
      programId: 'program:content-expanded',
      nodeId: 'rule',
    })).resolves.toMatchObject({ content_id: 'program:content-collapsed' });
    await expect(advanceProgramPin({
      programId: 'program:content-expanded',
      nodeId: 'rule',
      toContentId: 'program:interior-edited',
    })).resolves.toMatchObject({ content_id: 'program:content-advanced' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/harness/programmable-graph', expect.objectContaining({
      body: JSON.stringify({
        tool: 'programmable_graph_apply',
        action: 'expand_node',
        args: { program_id: 'program:content-before', node_id: 'rule' },
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/harness/programmable-graph', expect.objectContaining({
      body: JSON.stringify({
        tool: 'programmable_graph_apply',
        action: 'advance_pin',
        args: {
          program_id: 'program:content-expanded',
          node_id: 'rule',
          to_content_id: 'program:interior-edited',
        },
      }),
    }));
  });

  it('reads environment and interior through query actions', async () => {
    const interior = {
      tenant_id: 'tenant',
      name: 'Interior',
      intent: '',
      authority: 'advisory',
      environment: { bindings: [] },
      trigger: { kind: 'graph_change', labels: [], properties: [] },
      budget: { max_invocations: 1, window_seconds: 1, max_cost_microunits: 1 },
      approval: { mode: 'preapproved_within_grants', grant_ids: [] },
      nodes: [],
      edges: [],
      metadata: {},
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: {
          node_id: 'program:exterior',
          program_id: 'program:content',
          environment: { bindings: [{ engine_id: 'e1', affordance_id: 'a1', params: {}, contributed_by_program_id: 'program:content' }] },
          palette: [{ kind: 'rule', required_engines: [] }],
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: {
          exterior_node_id: 'program:exterior',
          node_id: 'rule',
          interior_program_id: 'program:interior',
          pinned_content_id: 'program:interior',
          program: interior,
        },
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProgramEnvironment('program:content')).resolves.toMatchObject({
      program_id: 'program:content',
      palette: [{ kind: 'rule' }],
    });
    await expect(fetchProgramInterior({
      programId: 'program:content',
      nodeId: 'rule',
    })).resolves.toMatchObject({
      pinned_content_id: 'program:interior',
      program: interior,
    });
  });
});
