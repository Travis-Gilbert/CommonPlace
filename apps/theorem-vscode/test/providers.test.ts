// SOURCING: vitest plus the local `vscode` stub. Assertions are the acceptance
// clauses of V2, V3, V4, V5, and V6.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_CONCURRENCY_REFUSAL,
  FIXTURE_CONTENT_HASH,
  FIXTURE_DIAGNOSTICS,
  FIXTURE_DIAGNOSTICS_COLD,
  FIXTURE_FIX_PREVIEW,
  FIXTURE_HISTORY,
  FIXTURE_INLAY_HINTS,
  FIXTURE_INTENTIONS,
  FIXTURE_READINESS_COLD,
  FIXTURE_READINESS_WARM,
  FIXTURE_SOURCE,
  FIXTURE_TOKENS,
  FIXTURE_TOKENS_COLD,
  FIXTURE_URI,
} from '@commonplace/block-view-contracts/editor-intelligence-fixture';
import { contentHashOf } from '@commonplace/block-view-contracts/editor-content-hash';
import { buildOffsetTable } from '@commonplace/block-view-contracts/editor-offsets';
import * as vscode from 'vscode';
import { SubstrateClient } from '../src/substrate/client';
import {
  IntelligenceSurface,
  TheoremCodeActionProvider,
  TheoremInlayHintProvider,
  TheoremTokenProvider,
  buildTokens,
} from '../src/intelligence/surface';
import { readableReduced, readableUnavailable } from '../src/degradation';
import {
  TheoremTimelineProvider,
  registerTimeline,
  showHistoryQuickPick,
  timelineProposalGranted,
  toTimelineItem,
} from '../src/timeline/history';
import { isInsideProject, rankHits, registerSpineSearch, searchProposalGranted } from '../src/search/spine';
import { TheoremFileSystemProvider, itemIdFromUri } from '../src/fs/theorem-fs';
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

const ITEM_BODY = 'body';
const ITEM_BODY_HASH = contentHashOf(ITEM_BODY);

/** Store double: answers each document by the query it was asked. */
function storeFetch(state: { cold: boolean; seamAlive: boolean; itemMoved?: boolean }): typeof fetch {
  return (async (_url: string, init: { body: string }) => {
    const { query, variables } = JSON.parse(init.body) as {
      query: string;
      variables: Record<string, unknown>;
    };

    if (query.includes('query FileIntelligence')) {
      return json({
        semanticTokens: state.cold ? FIXTURE_TOKENS_COLD : FIXTURE_TOKENS,
        diagnostics: state.cold ? FIXTURE_DIAGNOSTICS_COLD : FIXTURE_DIAGNOSTICS,
        inlayHints: FIXTURE_INLAY_HINTS,
      });
    }
    if (query.includes('query Intentions')) {
      return json({ intentions: FIXTURE_INTENTIONS });
    }
    if (query.includes('query EditorReadiness')) {
      return json({ readiness: state.cold ? FIXTURE_READINESS_COLD : FIXTURE_READINESS_WARM });
    }
    if (query.includes('query PreviewFix')) {
      return json({ previewFix: FIXTURE_FIX_PREVIEW });
    }
    if (query.includes('mutation ApplyFix')) {
      // Preview and applied are the same edits by construction, which is what
      // "preview equals applied" has to mean for a seam that owns the write.
      return json({ applyFix: FIXTURE_FIX_PREVIEW });
    }
    if (query.includes('query Item')) {
      return json({
        item: {
          id: variables.id,
          kind: 'note',
          title: 'A record',
          bodyText: ITEM_BODY,
          blobHash: null,
          mime: 'text/markdown',
          updatedAtMs: 1_785_000_000_000,
        },
      });
    }
    if (query.includes('mutation WriteItemBody')) {
      if (!state.seamAlive) return { ok: false, status: 502 } as unknown as Response;
      if (state.itemMoved) {
        return json({ writeItemBody: FIXTURE_CONCURRENCY_REFUSAL });
      }
      return json({
        writeItemBody: {
          __typename: 'ItemWriteReceiptGql',
          receiptId: 'rcpt-1',
          itemId: variables.id,
          baseContentHash: variables.baseContentHash,
          contentHash: contentHashOf(String(variables.text)),
        },
      });
    }
    if (query.includes('query FileHistory') || query.includes('mutation RestoreRevision')) {
      const key = query.includes('mutation') ? 'restoreRevision' : 'fileHistory';
      return json({ [key]: FIXTURE_HISTORY });
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

/** A document double with the two methods the surface asks of one. */
function fakeDocument(target: vscode.Uri, text = FIXTURE_SOURCE) {
  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') lineStarts.push(index + 1);
  }
  return {
    uri: target,
    getText: () => text,
    offsetAt: (position: vscode.Position) =>
      Math.min((lineStarts[position.line] ?? 0) + position.character, text.length),
  } as unknown as vscode.TextDocument;
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
      FIXTURE_DIAGNOSTICS.diagnostics.map((finding) => finding.detector),
    );
    expect(rendered[0]?.message).toBe(FIXTURE_DIAGNOSTICS.diagnostics[0]?.message);

    surface.dispose();
    client.dispose();
  });

  it('treats a cold index as reduced and quiet, not as an alarm', async () => {
    // degraded:true with a named missing index is the steady state for a fresh
    // mount. The surface still answers; the earlier build of this pack rendered
    // exactly this as a warning with a slashed-circle chip.
    const state = { cold: true, seamAlive: true };
    const { client, surface } = surfaceFor(state);
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.missingIndexes.length).toBe(1));

    const snapshot = surface.snapshot(uri);
    expect(snapshot?.missingIndexes).toEqual(['compute_code']);
    // Reduced, not unavailable: nothing here says the editor is disconnected.
    expect(snapshot?.unavailable).toBeUndefined();
    expect(readableReduced(snapshot!.missingIndexes)).toBe(
      'Theorem: symbol resolution is still building.',
    );
    // And it is still answering: findings and tokens came back.
    expect(recordedDiagnostics.get(uri.toString())).toHaveLength(1);

    state.cold = false;
    await client.refreshAll();
    await vi.waitFor(() => expect(surface.snapshot(uri)?.missingIndexes).toEqual([]));

    surface.dispose();
    client.dispose();
  });

  it('keeps the last findings when the endpoint dies, and says why they may be old', async () => {
    const dying = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    const dead = new IntelligenceSurface(dying);
    dead.watch(uri);
    await vi.waitFor(() => expect(dead.snapshot(uri)?.unavailable?.level).toBe('unavailable'));

    expect(readableUnavailable(dead.snapshot(uri)!.unavailable!)).toBe('Theorem is unreachable.');
    // Nothing invented: no findings claimed, and no empty list pretending to be clean.
    expect(recordedDiagnostics.get(uri.toString())).toBeUndefined();

    dead.dispose();
    dying.dispose();
  });

  it('previews a fix before applying it, and the applied edits equal the preview', async () => {
    const { client, surface } = surfaceFor({ cold: false, seamAlive: true });
    const outcome = await surface.applyFix(FIXTURE_FIX_PREVIEW.fixId);
    expect('edits' in outcome).toBe(true);
    if ('edits' in outcome) expect(outcome.edits).toEqual(FIXTURE_FIX_PREVIEW.edits);
    // The stub exposes no applyEdit; reaching for one would throw here.
    expect((vscode as unknown as { workspace: Record<string, unknown> }).workspace.applyEdit).toBeUndefined();
    surface.dispose();
    client.dispose();
  });

  it('surfaces a refused fix as a value rather than a thrown failure', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: (async (_url: string, init: { body: string }) => {
        const { query } = JSON.parse(init.body) as { query: string };
        if (query.includes('query PreviewFix')) return json({ previewFix: FIXTURE_FIX_PREVIEW });
        return json({ applyFix: FIXTURE_CONCURRENCY_REFUSAL });
      }) as unknown as typeof fetch,
    });
    const surface = new IntelligenceSurface(client);
    const outcome = await surface.applyFix(FIXTURE_FIX_PREVIEW.fixId);
    expect(outcome).toMatchObject({ __typename: 'EditorConcurrencyRefusalGql' });
    surface.dispose();
    client.dispose();
  });

  it('offers both block intentions as commands, matched on their published ids', async () => {
    const { client, surface } = surfaceFor({ cold: false, seamAlive: true });
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.table).toBeDefined());

    await surface.refreshIntentions(fakeDocument(uri), new vscode.Position(2, 8));
    await vi.waitFor(() => expect(surface.snapshot(uri)?.intentions.length).toBe(3));

    const actions = new TheoremCodeActionProvider(surface).provideCodeActions(
      fakeDocument(uri),
      new vscode.Range(2, 0, 2, 20),
    );
    const commands = actions.map((action) => action.command?.command);
    expect(commands).toContain('theorem.sendSelectionToComposer');
    expect(commands).toContain('theorem.saveSelectionToGraph');
    expect(commands).toContain('theorem.applyFix');

    surface.dispose();
    client.dispose();
  });

  it('sorts tokens into document order before delta-encoding', () => {
    const table = buildOffsetTable(FIXTURE_SOURCE, FIXTURE_CONTENT_HASH);
    const reversed = [...FIXTURE_TOKENS.tokens].reverse();
    expect(buildTokens(table, reversed).data).toEqual(buildTokens(table, FIXTURE_TOKENS.tokens).data);
  });

  it('answers tokens and hints from the held snapshot, not the network', async () => {
    const { client, surface } = surfaceFor({ cold: false, seamAlive: true });
    surface.watch(uri);
    await vi.waitFor(() => expect(surface.snapshot(uri)?.table).toBeDefined());

    const tokens = new TheoremTokenProvider(surface).provideDocumentSemanticTokens(fakeDocument(uri));
    expect(tokens.data.length).toBe(FIXTURE_TOKENS.tokens.length * 5);

    // The core inlay-hint provider is documented as empty; an empty list here is
    // the contract holding, not a transport failure.
    const hints = new TheoremInlayHintProvider(surface).provideInlayHints(
      fakeDocument(uri),
      new vscode.Range(0, 0, 8, 0),
    );
    expect(hints).toEqual([]);

    surface.dispose();
    client.dispose();
  });
});

describe('V3 timeline', () => {
  it('lists revisions newest first, keyed by generation', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const timeline = await new TheoremTimelineProvider(client).provideTimeline(uri);
    expect(timeline.items.map((item: { id?: string }) => item.id)).toEqual(['41', '40']);
    expect(timeline.items[1]?.label).toBe('before the accumulator landed');
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

  it('hangs the compare command off every revision, carrying its generation', () => {
    const item = toTimelineItem(uri, {
      generation: 39,
      hash: 'blake3:abc',
      label: 'restore of 37',
      timestampMs: 5,
    });
    expect(item.command?.command).toBe('theorem.diffRevision');
    expect(item.command?.arguments?.[1]).toBe(39);
    expect(item.contextValue).toBe('theorem.revision');
  });

  it('restores by generation and returns the history containing the new revision', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const outcome = await new TheoremTimelineProvider(client).restore(uri, 40);
    expect('revisions' in outcome).toBe(true);
    if ('revisions' in outcome) expect(outcome.revisions).toHaveLength(2);
    client.dispose();
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
    setQuickPickAnswer({ label: 'Revision 41', id: '41', runnable: true });
    await showHistoryQuickPick(provider, uri, vscode as never);

    expect(quickPickItems.at(-1)).toHaveLength(2);
    expect(executedCommands.at(-1)).toMatchObject({
      command: 'theorem.diffRevision',
      args: [uri, 41],
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
  it('reads the item id out of the uri, extension and all', () => {
    expect(itemIdFromUri(vscode.Uri.parse('theorem://item/spec-123.md'))).toBe('spec-123');
    expect(itemIdFromUri(vscode.Uri.parse('theorem://item/rec-9'))).toBe('rec-9');
  });

  it('round-trips a save, declaring the base it read and keeping the receipt', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const fs = new TheoremFileSystemProvider(client);
    const target = vscode.Uri.parse('theorem://item/rec-9.md');

    expect(Buffer.from(await fs.readFile(target)).toString('utf8')).toBe(ITEM_BODY);
    await fs.writeFile(target, Buffer.from('edited', 'utf8'));

    const receipt = fs.receiptFor('rec-9');
    expect(receipt?.receiptId).toBe('rcpt-1');
    // The base declared is the hash of the body that was read, not of the bytes
    // being written. Hashing the outgoing buffer would always match itself.
    expect(receipt?.baseContentHash).toBe(ITEM_BODY_HASH);
    expect(receipt?.contentHash).toBe(contentHashOf('edited'));

    client.dispose();
  });

  it('refuses a save the session never read, because it has no base to declare', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true }),
    });
    const fs = new TheoremFileSystemProvider(client);
    await expect(
      fs.writeFile(vscode.Uri.parse('theorem://item/rec-unread.md'), Buffer.from('x', 'utf8')),
    ).rejects.toMatchObject({ code: 'Unavailable' });
    client.dispose();
  });

  it('surfaces a concurrency refusal as a refusal, not as a generic failure', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: true, itemMoved: true }),
    });
    const fs = new TheoremFileSystemProvider(client);
    const target = vscode.Uri.parse('theorem://item/rec-9.md');
    await fs.readFile(target);

    await expect(fs.writeFile(target, Buffer.from('edited', 'utf8'))).rejects.toMatchObject({
      code: 'FileExists',
    });
    // Nothing was written, so nothing was receipted.
    expect(fs.receiptFor('rec-9')).toBeUndefined();
    client.dispose();
  });

  it('fails the save when the seam is severed, rather than accepting it', async () => {
    const client = new SubstrateClient({
      endpoint: { graphqlUrl: 'http://store.test/graphql' },
      fetchImpl: storeFetch({ cold: false, seamAlive: false }),
    });
    const fs = new TheoremFileSystemProvider(client);
    const target = vscode.Uri.parse('theorem://item/rec-9.md');
    await fs.readFile(target);

    await expect(fs.writeFile(target, Buffer.from('edited', 'utf8'))).rejects.toMatchObject({
      code: 'Unavailable',
    });
    expect(fs.receiptFor('rec-9')).toBeUndefined();
    client.dispose();
  });
});

describe('V6 agent presence', () => {
  const presence = new AgentPresence(
    { consoleOrigin: 'https://console.test/' },
    { open: async () => ({ sessionId: 's1', prompt: async () => undefined, onPermissionRequest: () => undefined, dispose: () => undefined }) },
  );

  it('opens the session rooted at the workspace folder', async () => {
    // The root is what makes a relative path in a prompt mean anything. It was
    // computed and then dropped on the way to the opener.
    const roots: (string | undefined)[] = [];
    (vscode as unknown as { workspace: { workspaceFolders: unknown } }).workspace.workspaceFolders = [
      { uri: { fsPath: '/work/project' } },
    ];
    const rooted = new AgentPresence(
      { consoleOrigin: 'https://console.test/' },
      {
        open: async (workspaceRoot) => {
          roots.push(workspaceRoot);
          return {
            sessionId: 's2',
            prompt: async () => undefined,
            onPermissionRequest: () => undefined,
            dispose: () => undefined,
          };
        },
      },
    );
    await rooted.start();
    expect(roots).toEqual(['/work/project']);
    rooted.dispose();
    (vscode as unknown as { workspace: { workspaceFolders: unknown } }).workspace.workspaceFolders =
      undefined;
  });

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
