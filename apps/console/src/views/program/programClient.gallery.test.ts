import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  canForkGalleryEntry,
  consumePendingProgramFork,
  fetchCommandGallery,
  forkGalleryEntry,
  lineageFromProgram,
  programCanvasHref,
  shouldBlockRunAfterValidation,
  storePendingProgramFork,
  validateProgramDefinition,
  PENDING_PROGRAM_FORK_KEY,
} from '../../views/program/programClient';
import type { CommandGalleryEntry } from '../../views/program/programClient';
import type { ProgramDefinition } from '@commonplace/program-contracts';

const FORK_PROGRAM: ProgramDefinition = {
  tenant_id: 'Travis-Gilbert',
  name: 'Fork of Price watch',
  intent: 'Watch price',
  authority: 'advisory',
  parent_program_id: 'cid:price',
  environment: { bindings: [] },
  trigger: { kind: 'graph_change', labels: [], properties: [] },
  budget: { max_invocations: 10, window_seconds: 3600, max_cost_microunits: 1 },
  approval: { mode: 'preapproved_within_grants', grant_ids: [] },
  nodes: [],
  edges: [],
  metadata: { forked_from: 'cid:price', draft: true },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('programClient gallery + validate', () => {
  const originalFetch = globalThis.fetch;
  const memory = new Map<string, string>();

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    memory.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('maps gallery entries from substrate', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        ok: true,
        result: {
          entries: [
            {
              kind: 'monitor_template',
              slug_or_name: 'Price watch',
              title: 'Price watch',
              summary: 'Watch price',
              program_id: 'cid:price',
              validation: {
                program_id: 'cid:price',
                checks: [{ requirement: 'program_identity', passed: true }],
              },
            },
          ],
        },
      }),
    );
    const entries = await fetchCommandGallery();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe('Price watch');
    expect(entries[0]?.source).toBe('substrate');
    expect(entries[0]?.validationPassed).toBe(true);
  });

  it('falls back to LocalDevCommandGallery when gallery refuses', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ error: 'console_harness_unconfigured' }, 404),
    );
    const entries = await fetchCommandGallery();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.source === 'LocalDevCommandGallery')).toBe(true);
  });

  it('refuses LocalDev stand-ins and allows substrate commands', () => {
    expect(canForkGalleryEntry({
      kind: 'monitor_template',
      source: 'LocalDevCommandGallery',
    })).toBe(false);
    expect(canForkGalleryEntry({
      kind: 'command',
      source: 'substrate',
    })).toBe(true);
  });

  it('reads parent_program_id and forked_from as lineage', () => {
    expect(lineageFromProgram(FORK_PROGRAM)).toBe('cid:price');
    expect(programCanvasHref('node:fork')).toBe('/program?id=node%3Afork');
  });

  it('forks a template, stages the canvas handoff, and persists when apply answers', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        action?: string;
      };
      if (body.action === 'gallery_fork') {
        return jsonResponse({ ok: true, result: { program: FORK_PROGRAM } });
      }
      if (body.action === 'save') {
        return jsonResponse({ ok: true, result: { node_id: 'node:fork' } });
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    });
    const template: CommandGalleryEntry = {
      kind: 'monitor_template',
      slugOrName: 'Price watch',
      title: 'Price watch',
      summary: 'Watch price',
      programId: 'cid:price',
      source: 'substrate',
    };
    const result = await forkGalleryEntry(template);
    expect(result.nodeId).toBe('node:fork');
    expect(result.parentProgramId).toBe('cid:price');
    expect(result.href).toBe('/program?id=node%3Afork');
    expect(consumePendingProgramFork()?.nodeId).toBe('node:fork');
    const forkCall = vi.mocked(globalThis.fetch).mock.calls.find((call) => {
      const body = JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? '{}')) as {
        action?: string;
      };
      return body.action === 'gallery_fork';
    });
    expect(forkCall).toBeTruthy();
    const forkBody = JSON.parse(String((forkCall?.[1] as RequestInit).body)) as {
      args?: { parent_program_id?: string; publish?: boolean };
    };
    expect(forkBody.args?.parent_program_id).toBe('cid:price');
    expect(forkBody.args?.publish).toBe(false);
  });

  it('forks a published command by loading its definition first', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string };
      if (body.action === 'load') {
        return jsonResponse({
          ok: true,
          result: { definition: { ...FORK_PROGRAM, name: 'Price', parent_program_id: null } },
        });
      }
      if (body.action === 'gallery_fork') {
        return jsonResponse({ ok: true, result: { program: FORK_PROGRAM } });
      }
      if (body.action === 'save') {
        return jsonResponse({ ok: true, result: { node_id: 'node:cmd-fork' } });
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    });
    const command: CommandGalleryEntry = {
      kind: 'command',
      slugOrName: 'price',
      title: 'Price',
      summary: 'Published price command',
      programId: 'cid:price',
      publicationRef: 'pub:1',
      source: 'substrate',
    };
    const result = await forkGalleryEntry(command);
    expect(result.nodeId).toBe('node:cmd-fork');
    const actions = vi.mocked(globalThis.fetch).mock.calls.map((call) => {
      return (JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? '{}')) as {
        action?: string;
      }).action;
    });
    expect(actions).toEqual(['load', 'gallery_fork', 'save']);
    const forkBody = JSON.parse(String((vi.mocked(globalThis.fetch).mock.calls[1]?.[1] as RequestInit).body)) as {
      args?: { definition?: { name?: string } };
    };
    expect(forkBody.args?.definition?.name).toBe('Price');
  });

  it('still stages the canvas when save/apply is unreachable', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string };
      if (body.action === 'gallery_fork') {
        return jsonResponse({ ok: true, result: { program: FORK_PROGRAM } });
      }
      return jsonResponse({ error: 'apply_unreachable' }, 502);
    });
    const result = await forkGalleryEntry({
      kind: 'monitor_template',
      slugOrName: 'Price watch',
      title: 'Price watch',
      summary: 'Watch price',
      programId: 'cid:price',
      source: 'substrate',
    });
    expect(result.nodeId).toBeUndefined();
    expect(result.href).toBe('/program');
    expect(consumePendingProgramFork()?.program.name).toBe('Fork of Price watch');
  });

  it('round-trips pending fork storage', () => {
    storePendingProgramFork({
      program: FORK_PROGRAM,
      nodeId: 'node:fork',
      parentProgramId: 'cid:price',
    });
    expect(sessionStorage.getItem(PENDING_PROGRAM_FORK_KEY)).toBeTruthy();
    expect(consumePendingProgramFork()?.nodeId).toBe('node:fork');
    expect(consumePendingProgramFork()).toBeNull();
  });

  it('parses validate refusal with node ids', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        ok: false,
        refusal: {
          code: 'typed_stream_edges',
          message: 'edge mismatch',
          node_ids: ['n1', 'n2'],
        },
      }),
    );
    const result = await validateProgramDefinition({
      tenant_id: 't',
      name: 'x',
      intent: 'y',
      trigger: { kind: 'manual' },
      budget: {},
      approval: {},
      nodes: [],
      edges: [],
      metadata: {},
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.nodeIds).toEqual(['n1', 'n2']);
      expect(result.code).toBe('typed_stream_edges');
      expect(shouldBlockRunAfterValidation(result)).toBe(true);
    }
  });

  it('blocks run when validate checks fail', () => {
    expect(
      shouldBlockRunAfterValidation({
        ok: true,
        receipt: {
          program_id: 'p',
          checks: [{ requirement: 'cycles', passed: false }],
        },
      }),
    ).toBe(true);
    expect(
      shouldBlockRunAfterValidation({
        ok: true,
        receipt: {
          program_id: 'p',
          checks: [{ requirement: 'cycles', passed: true }],
        },
      }),
    ).toBe(false);
  });
});
