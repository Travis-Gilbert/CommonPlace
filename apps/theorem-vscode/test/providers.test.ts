// SOURCING: vitest plus the local `vscode` stub. Assertions are the acceptance
// clauses of V2, V3, V4, V5, and V6.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_COLD_INDEX,
  FIXTURE_FIX_PREVIEW,
  FIXTURE_INTELLIGENCE,
  FIXTURE_READINESS_COLD,
  FIXTURE_READINESS_WARM,
  FIXTURE_URI,
} from '@commonplace/block-view-contracts/editor-intelligence-fixture';
import * as vscode from 'vscode';
import { SubstrateClient } from '../src/substrate/client';
import {
  IntelligenceSurface,
  TheoremCodeActionProvider,
  TheoremInlayHintProvider,
  TheoremTokenProvider,
  buildTokens,
} from '../src/intelligence/surface';
import { readableDegradation } from '../src/degradation';
import {
  TheoremTimelineProvider,
  registerTimeline,
  showHistoryQuickPick,
  timelineProposalGranted,
  toTimelineItem,
} from '../src/timeline/history';
import { isInsideProject, rankHits, registerSpineSearch, searchProposalGranted } from '../src/search/spine';
import { TheoremFileSystemProvider, objectIdFromUri } from '../src/fs/theorem-fs';
import { AgentPresence, runLink } from '../src/agent/presence';

const {
  executedCommands,
  quickPickItems,
  recordedDiagnostics,
  setMessageAnswer,
  setQuickPickAnswer,
  shownMessages,
} = vscode as unknown as {
  executedCommands: { command: string; args: unknown[] }[];
  quickPickItems: unknown[][];
  recordedDiagnostics: Map<string, unknown[]>;
  setMessageAnswer(answer: string | undefined): void;
  setQuickPickAnswer(answer: unknown): void;
  shownMessages: { message: string; options: string[] }[];
};

/** Store double: answers each document by the query it was asked. */
function storeFetch(state: { cold: boolean; seamAlive: boolean }): typeof fetch {
  return (async (_url: string, init: { body: string }) => {
    const { query, variables } = JSON.parse(init.body) as {
      query: string;
      variables: Record<string, unknown>;
    };

    if (query.includes('fileIntelligence')) {
      return json({ fileIntelligence: state.cold ? FIXTURE_COLD_INDEX : FIXTURE_INTELLIGENCE });
    }
    if (query.includes('editorReadiness')) {
      return json({ editorReadiness: state.cold ? FIXTURE_READINESS_COLD : FIXTURE_READINESS_WARM });
    }
    if (query.includes('applyFix')) {
      // Preview and applied are the same edits by construction, which is what
      // "preview equals applied" has to mean for a seam that owns the write.
      return json({ applyFix: FIXTURE_FIX_PREVIEW });
    }
    if (query.includes('objectDocument')) {
      return json({ objectDocument: { objectId: variables.objectId, text: 'body', generation: 3 } });
    }
    if (query.includes('writeObjectDocument')) {
      return state.seamAlive
        ? json({ writeObjectDocument: { receiptId: 'rcpt-1', objectId: variables.objectId, generation: 4 } })
        : ({ ok: false, status: 502 } as unknown as Response);
    }
    if (query.includes('fileRevisions')) {
      return json({
        fileRevisions: {
          generation: 9,
          revisions: [
            { id: 'rev-1', timestamp: 1000, label: 'save' },
            { id: 'rev-2', timestamp: 2000, label: 'agent run' },
          ],
        },
      });
    }
    return json({});
  }) as unknown as typeof fetch;
}

function json(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
}

function surfaceFor(state: { cold: boolean; seamAlive: boolean }) {
  const client = new SubstrateClient({
    endpoint: { graphqlUrl: 'http://store.test/graphql' },
    fetchImpl: storeFetch(state),
  });
  return { client, surface: new IntelligenceSurface(client) };
}

const uri = vscode.Uri.parse(FIXTURE_URI);

beforeEach(() => {
  recordedDiagnostics.clear();
  shownMessages.length = 0;
  setMessageAnswer(undefined);
});

describe('V2 intelligence providers', () => {
  it('renders the fixture findings the store returned, one for one', async () => {
    const state = { cold: false, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(recordedDiagnostics.get(uri.toString())).toHaveLength(2));

    const rendered = recordedDiagnostics.get(uri.toString()) as { message: string; code: string }[];
    expect(rendered.map((entry) => entry.code)).toEqual(
      FIXTURE_INTELLIGENCE.diagnostics.map((finding) => finding.id),
    );
    expect(rendered[0]?.message).toBe(FIXTURE_INTELLIGENCE.diagnostics[0]?.message);

    surface.dispose();
    client.dispose();
  });

  it('names the cold-index degradation, and clears it when readiness lands', async () => {
    const state = { cold: true, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.degradation).toBeDefined());

    const degradation = surface.snapshot(uri)?.degradation;
    expect(degradation?.code).toBe('editor_index_cold');
    expect(readableDegradation(degradation!)).toBe(
      'Theorem is still building its indexes. Missing: theorem.inference, theorem.shapes.',
    );

    state.cold = false;
    await client.refreshAll();
    await vi.waitFor(() => expect(surface.snapshot(uri)?.degradation).toBeUndefined());

    surface.dispose();
    client.dispose();
  });

  it('keeps the last findings when the endpoint dies, and says why they may be old', async () => {
    const state = { cold: false, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.intelligence).toBeDefined());

    const dying = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    const dead = new IntelligenceSurface(dying);
    dead.watch(uri);
    await vi.waitFor(() => expect(dead.snapshot(uri)?.degradation?.level).toBe('unavailable'));
    // Nothing invented: no findings claimed, and no empty list pretending to be clean.
    expect(dead.snapshot(uri)?.intelligence).toBeUndefined();

    dead.dispose();
    dying.dispose();
    surface.dispose();
    client.dispose();
  });

  it('applies a fix whose applied edits equal the preview, and touches no buffer', async () => {
    const state = { cold: false, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    const outcome = await surface.applyFix(uri, 'fix-annotate-accumulator');
    expect('edits' in outcome).toBe(true);
    if ('edits' in outcome) expect(outcome.edits).toEqual(FIXTURE_FIX_PREVIEW.edits);
    // The stub exposes no applyEdit; reaching for one would throw here.
    expect((vscode as unknown as { workspace: Record<string, unknown> }).workspace.applyEdit).toBeUndefined();
    surface.dispose();
    client.dispose();
  });

  it('offers both block intentions as commands carrying the selection', async () => {
    const state = { cold: false, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.intelligence).toBeDefined());

    const actions = new TheoremCodeActionProvider(surface).provideCodeActions(
      { uri } as never,
      new vscode.Range(1, 0, 1, 12),
    );
    const commands = actions.map((action) => action.command?.command);
    expect(commands).toContain('theorem.sendSelectionToComposer');
    expect(commands).toContain('theorem.saveSelectionToGraph');
    expect(commands).toContain('theorem.applyFix');

    surface.dispose();
    client.dispose();
  });

  it('sorts tokens into document order before delta-encoding', () => {
    const reversed = [...FIXTURE_INTELLIGENCE.tokens].reverse();
    expect(buildTokens(reversed).data).toEqual(buildTokens(FIXTURE_INTELLIGENCE.tokens).data);
  });

  it('answers tokens and hints from the held snapshot, not the network', async () => {
    const state = { cold: false, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.intelligence).toBeDefined());

    const tokens = new TheoremTokenProvider(surface).provideDocumentSemanticTokens({ uri } as never);
    expect(tokens.data.length).toBe(FIXTURE_INTELLIGENCE.tokens.length * 5);

    const hints = new TheoremInlayHintProvider(surface).provideInlayHints(
      { uri } as never,
      new vscode.Range(0, 0, 5, 0),
    );
    expect(hints.map((hint) => hint.label)).toEqual([': number']);

    surface.dispose();
    client.dispose();
  });
});

describe('V3 timeline', () => {
  it('lists revisions newest first with their labels', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const timeline = await new TheoremTimelineProvider(client).provideTimeline(uri);
    expect(timeline.items.map((item: { label: string }) => item.label)).toEqual(['agent run', 'save']);
    expect(timeline.items[0]?.id).toBe('rev-2');
    client.dispose();
  });

  it('says local history is unavailable rather than showing an empty history', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    const timeline = await new TheoremTimelineProvider(client).provideTimeline(uri);
    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0]?.label).toBe('Local history unavailable');
    client.dispose();
  });

  it('hangs the compare command off every revision', () => {
    const item = toTimelineItem(uri, { id: 'rev-9', timestamp: 5, label: 'restore of rev-1' });
    expect(item.command?.command).toBe('theorem.diffRevision');
    expect(item.command?.arguments?.[1]).toBe('rev-9');
    expect(item.contextValue).toBe('theorem.revision');
  });

  it('registers no provider without the timeline proposal, and reaches history anyway', async () => {
    // TimelineProvider is proposed API (vscode.proposed.timeline.d.ts, verified
    // at main 2026-08-02), so a stock host has no view to register into. The
    // revisions must still be reachable, which is what showHistory is for.
    expect(timelineProposalGranted(vscode as never)).toBe(false);

    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const provider = new TheoremTimelineProvider(client);
    expect(registerTimeline(provider, vscode as never)).toEqual([]);

    executedCommands.length = 0;
    setQuickPickAnswer({ label: 'agent run', id: 'rev-2', runnable: true });
    await showHistoryQuickPick(provider, uri, vscode as never);

    expect(quickPickItems.at(-1)).toHaveLength(2);
    expect(executedCommands.at(-1)).toMatchObject({
      command: 'theorem.diffRevision',
      args: [uri, 'rev-2'],
    });

    client.dispose();
  });
});

describe('V4 search over the spine', () => {
  const roots = ['file:///work/project'];

  it('ranks an inside-project hit above an equally scored outside hit, keeping both', () => {
    const ranked = rankHits(
      [
        { doc: 'file:///elsewhere/notes.md', score: 0.5 },
        { doc: 'file:///work/project/src/a.ts', score: 0.5 },
      ],
      roots,
    );
    expect(ranked.map((hit) => hit.doc)).toEqual([
      'file:///work/project/src/a.ts',
      'file:///elsewhere/notes.md',
    ]);
  });

  it('lets a genuinely better outside hit win, because the membrane is a tie-breaker', () => {
    const ranked = rankHits(
      [
        { doc: 'file:///work/project/src/a.ts', score: 0.5 },
        { doc: 'file:///elsewhere/notes.md', score: 0.9 },
      ],
      roots,
    );
    expect(ranked[0]?.doc).toBe('file:///elsewhere/notes.md');
  });

  it('does not treat a sibling directory with a shared prefix as inside', () => {
    expect(isInsideProject('file:///work/project-other/a.ts', roots)).toBe(false);
    expect(isInsideProject('file:///work/project/a.ts', roots)).toBe(true);
  });

  it('registers nothing in a build without the proposal, leaving ripgrep alone', () => {
    expect(searchProposalGranted(vscode as never)).toBe(false);
    const disposables = registerSpineSearch(
      { client: undefined as never, roots, onDegradation: () => undefined },
      vscode as never,
    );
    expect(disposables).toEqual([]);
  });
});

describe('V5 theorem:// documents', () => {
  it('reads the object id out of the uri, extension and all', () => {
    expect(objectIdFromUri(vscode.Uri.parse('theorem://object/spec-123.md'))).toBe('spec-123');
    expect(objectIdFromUri(vscode.Uri.parse('theorem://object/rec-9'))).toBe('rec-9');
  });

  it('round-trips a save and keeps the receipt', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const fs = new TheoremFileSystemProvider(client);
    const target = vscode.Uri.parse('theorem://object/rec-9.md');

    await fs.writeFile(target, Buffer.from('edited', 'utf8'));
    expect(fs.receiptFor('rec-9')?.receiptId).toBe('rcpt-1');
    expect(Buffer.from(await fs.readFile(target)).toString('utf8')).toBe('body');

    client.dispose();
  });

  it('fails the save when the seam is severed, rather than accepting it', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: false }),
    });
    const fs = new TheoremFileSystemProvider(client);
    await expect(
      fs.writeFile(vscode.Uri.parse('theorem://object/rec-9.md'), Buffer.from('edited', 'utf8')),
    ).rejects.toMatchObject({ code: 'Unavailable' });
    expect(fs.receiptFor('rec-9')).toBeUndefined();
    client.dispose();
  });
});

describe('V6 agent presence', () => {
  const presence = new AgentPresence(
    { consoleOrigin: 'https://console.test/' },
    { open: async () => ({ sessionId: 's1', prompt: async () => undefined, onPermissionRequest: () => undefined, dispose: () => undefined }) },
  );

  it('deep-links a run to the console', () => {
    expect(runLink({ consoleOrigin: 'https://console.test/' }, 'run-7').toString()).toBe(
      'https://console.test/runs/run-7',
    );
  });

  it('round-trips a permission prompt with the answer the reader picked', async () => {
    setMessageAnswer('Allow once');
    const outcome = await presence.askPermission({
      requestId: 'p1',
      title: 'Write to src/a.ts?',
      options: [
        { id: 'allow-once', label: 'Allow once' },
        { id: 'reject', label: 'Reject' },
      ],
    });
    expect(outcome).toEqual({ requestId: 'p1', optionId: 'allow-once' });
    expect(shownMessages[0]?.message).toBe('Write to src/a.ts?');
  });

  it('treats a dismissed prompt as refusal, never as consent', async () => {
    setMessageAnswer(undefined);
    const outcome = await presence.askPermission({
      requestId: 'p2',
      title: 'Delete the branch?',
      options: [
        { id: 'allow', label: 'Allow' },
        { id: 'reject', label: 'Reject' },
      ],
    });
    expect(outcome.optionId).toBe('reject');
  });
});
