'use client';

// SOURCING: @commonplace/model-canvas (OWOX hard fork) as the Data-model page
// body. Registry read/write stays in this adapter; plan-id BlockShell chrome
// is gone — the canvas is the page (SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0).

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  emptyDeclaredModel,
  emptyObservedModel,
  type PinKind,
  type SchemaProposalDraft,
} from '@commonplace/data-model-contracts';
import { DiffDialog, diffGraphs, type ModelGraph } from '@commonplace/model-canvas';
import '@commonplace/model-canvas/canvas.css';
import {
  exportOkfModel,
  fetchObservedModel,
  importOkfModel,
  postPin,
  postSchemaProposal,
  postSchemaRestore,
  postUnpin,
  previewOkfModel,
  type OkfModelPreviewPayload,
} from '@/lib/observed-model-client';
import { DiagramLens } from './ObservedDeclaredLenses';
import type { LayoutPositions } from './diagram/layout';
import {
  createModelQueryState,
  modelScopeFromSet,
  reduceModelQuery,
  type ModelSelection,
} from './modelQuery';
import { modelCanvasId } from '@/lib/canvas/store';
import type { JSONCanvas } from '@commonplace/json-canvas';
import {
  declaredToModelGraph,
  parseOkfBundle,
} from './okfBridge';
import {
  UNKNOWN_REGISTRY_SIGNAL,
  registryMoved,
  registrySignal,
  type RegistrySignal,
} from './registrySignal';

type ModelLayoutHost = ViewRenderProps['host'] & {
  readyNamedCanvas?(canvasId: string, title?: string): Promise<void>;
  exportCanvasDocument?(canvasId: string): JSONCanvas | null;
  applyCanvasDocument?(canvasId: string, document: JSONCanvas): Promise<{ ok: boolean; error?: string }>;
};

type OkfImportPreview = {
  readonly graph: ModelGraph;
  readonly diff: ReturnType<typeof diffGraphs>;
  readonly bundleId: string;
  readonly files: Readonly<Record<string, string>>;
  readonly server: OkfModelPreviewPayload;
};

function layoutDocumentFromPositions(positions: LayoutPositions): JSONCanvas {
  return {
    nodes: Object.entries(positions).map(([id, pos]) => ({
      id,
      type: 'text' as const,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      text: id,
      graphId: id,
    })),
    edges: [],
  };
}

function positionsFromLayoutDocument(document: JSONCanvas | null): LayoutPositions {
  if (!document) return {};
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of document.nodes) {
    positions[node.id] = { x: node.x, y: node.y };
  }
  return positions;
}

function ProposalCard({
  draft,
  busy,
  onAccept,
  onDecline,
}: {
  readonly draft: SchemaProposalDraft;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}) {
  return (
    <section className="border-b border-ij-seam bg-ij-warn-bg px-4 py-3 text-ij-ink" aria-labelledby="schema-proposal-heading">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ij-warn">Schema proposal draft</p>
          <h2 id="schema-proposal-heading" className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {draft.request}
          </h2>
          <p className="mt-2 text-ij-ink-info">{draft.validationSummary}</p>
          <p className="mt-1 text-ij-ink-info">{draft.impactSummary}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {draft.proposedPins.map((pin) => (
              <li key={`${pin.kind}:${pin.observedKey}`} className="rounded-ij-arc-underline bg-ij-raised px-2 py-1 font-ij-mono text-xs" data-mono-ok>
                {pin.kind}: {pin.observedKey}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy || draft.proposedPins.length === 0}
            onClick={onAccept}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    </section>
  );
}

const LAYOUT_PERSIST_MS = 400;
/** Fallback heartbeat for registry changes made outside this client. */
const REGISTRY_SIGNAL_MS = 15_000;

export function ModelView({ set, host }: ViewRenderProps) {
  const initialScope = modelScopeFromSet(set) ?? { kind: 'topic' as const, topicId: '' };
  const [queryState, dispatch] = useReducer(
    reduceModelQuery,
    initialScope,
    createModelQueryState,
  );
  const [observed, setObserved] = useState(() => emptyObservedModel(initialScope));
  const [declared, setDeclared] = useState(() => emptyDeclaredModel(initialScope));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [proposalRequest, setProposalRequest] = useState('');
  const [proposalComposerOpen, setProposalComposerOpen] = useState(false);
  const [proposal, setProposal] = useState<SchemaProposalDraft | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [layoutPositions, setLayoutPositions] = useState<LayoutPositions>({});
  const layoutPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest debounced positions and the writer, so unmount can flush them. */
  const pendingLayoutRef = useRef<LayoutPositions | null>(null);
  const persistLayoutRef = useRef<((positions: LayoutPositions) => Promise<void>) | null>(null);
  const [okfPreview, setOkfPreview] = useState<OkfImportPreview | null>(null);
  const [diffVersionIds, setDiffVersionIds] = useState<readonly [string, string]>(['', '']);
  const [diffOpen, setDiffOpen] = useState(false);
  const setScope = modelScopeFromSet(set);
  const layoutHost = host as ModelLayoutHost;
  const setScopeTopicId = setScope?.kind === 'topic' ? setScope.topicId : '';
  const setScopeTenant = setScope?.tenant;
  const topicId = queryState.scope.kind === 'topic' ? queryState.scope.topicId : '';

  useEffect(() => {
    if (!setScopeTopicId) return;
    dispatch({
      type: 'set-scope',
      scope: {
        kind: 'topic',
        topicId: setScopeTopicId,
        ...(setScopeTenant ? { tenant: setScopeTenant } : {}),
      },
    });
  }, [setScopeTenant, setScopeTopicId]);

  useEffect(() => {
    if (!topicId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const payload = await fetchObservedModel(topicId);
        if (!active) return;
        setObserved(payload.observed);
        setDeclared(payload.declared);
        setError(payload.error ?? null);
      } catch (loadError) {
        if (!active) return;
        const scope = { kind: 'topic' as const, topicId };
        setObserved(emptyObservedModel(scope));
        setDeclared(emptyDeclaredModel(scope));
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [topicId, reloadToken]);

  // Issue 144 E, the "now" seam. The object-seam subscription below only sees
  // changes this client made. A declaration from another head -- an agent, the
  // MCP door, a restore -- moves the registry without touching local objects,
  // and PR 385's versioned projections are how we notice: re-read the head
  // version on the same subscription tick and rehydrate only when the anchor
  // actually moved, so an unchanged registry costs one comparison.
  const registrySignalRef = useRef<RegistrySignal>(UNKNOWN_REGISTRY_SIGNAL);

  useEffect(() => {
    if (!declared) return;
    registrySignalRef.current = registrySignal(declared);
  }, [declared]);

  const pollRegistrySignal = useCallback(async () => {
    if (!topicId) return;
    try {
      const payload = await fetchObservedModel(topicId);
      const next = registrySignal(payload.declared);
      if (registryMoved(registrySignalRef.current, next)) {
        registrySignalRef.current = next;
        setReloadToken((token) => token + 1);
      }
    } catch {
      // A failed signal read is not a change. Staying on the last good
      // projection beats blanking a canvas because one poll lost the network.
    }
  }, [topicId]);

  useEffect(() => {
    if (!topicId) return;
    let unsubscribe: (() => void) | undefined;
    // theorem-canvas-compile has no console-consumable subscription contract in
    // rustyredcore_THG/crates/theorem-canvas-compile: it invalidates Program
    // CanvasDoc execution, not the registry projection rendered here. Until the
    // projection producer specified in
    // docs/plans/canvas/SPEC-REGISTRY-ERD-PROJECTION-1.0 exists, model state
    // subscribes to the registry metadata query plus the version signal above,
    // and every successful pin/unpin/import/restore also advances reloadToken.
    void Promise.resolve(host.query({
      types: [
        'object-type-metadata',
        'field-metadata',
        'relation-metadata',
        'view-metadata',
        'schema-version',
      ],
      where: { kind: 'eq', field: 'topic_id', value: topicId },
    })).then((set) => {
      unsubscribe = set.subscribe(() => {
        setReloadToken((token) => token + 1);
        void pollRegistrySignal();
      });
    }).catch(() => undefined);
    return () => unsubscribe?.();
  }, [host, pollRegistrySignal, topicId]);

  // A slow heartbeat is the fallback for declarations made entirely outside
  // this client, which the object seam cannot see at all. It reads the version
  // signal, not the canvas: an unmoved registry re-renders nothing.
  useEffect(() => {
    if (!topicId) return;
    const timer = setInterval(() => { void pollRegistrySignal(); }, REGISTRY_SIGNAL_MS);
    return () => clearInterval(timer);
  }, [pollRegistrySignal, topicId]);

  useEffect(() => {
    if (!topicId) return;
    let active = true;
    const canvasId = modelCanvasId(topicId);
    void Promise.resolve().then(async () => {
      try {
        if (layoutHost.readyNamedCanvas) {
          await layoutHost.readyNamedCanvas(canvasId, `Model layout ${topicId}`);
        }
        const document = layoutHost.exportCanvasDocument?.(canvasId) ?? null;
        if (!active) return;
        setLayoutPositions(positionsFromLayoutDocument(document));
      } catch {
        if (!active) return;
        setLayoutPositions({});
      }
    });
    return () => {
      active = false;
    };
  }, [layoutHost, topicId, reloadToken]);

  async function persistLayout(positions: LayoutPositions): Promise<void> {
    pendingLayoutRef.current = null;
    if (!topicId) return;
    const canvasId = modelCanvasId(topicId);
    const document = layoutDocumentFromPositions(positions);
    try {
      if (layoutHost.readyNamedCanvas) {
        await layoutHost.readyNamedCanvas(canvasId, `Model layout ${topicId}`);
      }
      if (layoutHost.applyCanvasDocument) {
        const applied = await layoutHost.applyCanvasDocument(canvasId, document);
        if (!applied.ok) {
          setError(applied.error ?? 'Model layout persist refused.');
        }
        return;
      }
      const applied = await host.emit({
        kind: 'invoke_tool',
        tool: 'canvas.apply_json',
        args: {
          canvasId,
          document: document as unknown as import('@commonplace/block-view/types').JsonValue,
        },
      });
      if (!applied.ok) {
        setError(applied.error ?? 'Model layout persist refused.');
      }
    } catch (layoutError) {
      setError(layoutError instanceof Error ? layoutError.message : String(layoutError));
    }
  }

  function scheduleLayoutPersist(positions: LayoutPositions): void {
    setLayoutPositions(positions);
    pendingLayoutRef.current = positions;
    if (layoutPersistTimer.current) clearTimeout(layoutPersistTimer.current);
    layoutPersistTimer.current = setTimeout(() => {
      void persistLayout(positions);
    }, LAYOUT_PERSIST_MS);
  }

  // Kept current after every render so the unmount flush below calls the
  // latest closure rather than one captured at mount.
  useEffect(() => {
    persistLayoutRef.current = persistLayout;
  });

  useEffect(() => () => {
    // Cancelling the debounce without writing loses the reader's last drag,
    // which the canvas durability contract does not allow. Flush what is
    // pending, then cancel.
    if (!layoutPersistTimer.current) return;
    clearTimeout(layoutPersistTimer.current);
    layoutPersistTimer.current = null;
    const pending = pendingLayoutRef.current;
    if (pending) void persistLayoutRef.current?.(pending);
  }, [topicId]);

  async function applyPin(
    observedKey: string,
    kind: PinKind,
    parentObservedKey?: string,
  ): Promise<void> {
    if (!topicId) return;
    dispatch({ type: 'pin-start', observedKey });
    setError(null);
    try {
      const result = await postPin({
        scope: { kind: 'topic', topicId },
        observedKey,
        kind,
        ...(parentObservedKey ? { parentObservedKey } : {}),
      }, host);
      setDeclared(result.declared);
      setNotice(result.receipt.note ?? `${observedKey} is declared.`);
      setReloadToken((token) => token + 1);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : String(pinError));
    } finally {
      dispatch({ type: 'pin-finish', observedKey });
    }
  }

  async function applyUnpin(declaredId: string): Promise<void> {
    if (!topicId) return;
    setError(null);
    try {
      const result = await postUnpin(topicId, declaredId, host);
      setDeclared(result.declared);
      setNotice(result.receipt.note ?? `${declaredId} is no longer declared.`);
      setReloadToken((token) => token + 1);
    } catch (unpinError) {
      setError(unpinError instanceof Error ? unpinError.message : String(unpinError));
    }
  }

  async function requestProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const request = proposalRequest.trim();
    if (!topicId || !request) return;
    setProposalBusy(true);
    setError(null);
    try {
      setProposal(await postSchemaProposal(topicId, request));
      setProposalRequest('');
      setProposalComposerOpen(false);
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setProposalBusy(false);
    }
  }

  async function acceptProposal(): Promise<void> {
    if (!proposal) return;
    setProposalBusy(true);
    setError(null);
    try {
      let nextDeclared = declared;
      for (const pin of proposal.proposedPins) {
        dispatch({ type: 'pin-start', observedKey: pin.observedKey });
        try {
          const result = await postPin(pin, host);
          nextDeclared = result.declared;
        } finally {
          dispatch({ type: 'pin-finish', observedKey: pin.observedKey });
        }
      }
      setDeclared(nextDeclared);
      setNotice('Schema proposal accepted and declared.');
      setProposal(null);
      setReloadToken((token) => token + 1);
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setProposalBusy(false);
    }
  }

  async function previewOkfImport(fileList: FileList | null): Promise<void> {
    if (!fileList?.length || !topicId) return;
    setError(null);
    try {
      const selectedFiles = [...fileList];
      const firstFile = selectedFiles[0];
      const firstSource = await firstFile.text();
      const files = selectedFiles.length === 1 && firstFile.name.endsWith('.json')
        ? JSON.parse(firstSource) as Record<string, string>
        : Object.fromEntries(await Promise.all(selectedFiles.map(async (file) => [
            file.webkitRelativePath || file.name,
            await file.text(),
          ])));
      const bundleId = firstFile.name
        .replace(/\.okf\.json$/i, '')
        .replace(/\.(json|md)$/i, '')
        .trim() || 'model-import';
      const [graph, server] = await Promise.all([
        Promise.resolve(parseOkfBundle(JSON.stringify(files), `${bundleId}.json`)),
        previewOkfModel(bundleId, files),
      ]);
      setOkfPreview({
        graph,
        diff: diffGraphs(declaredToModelGraph(declared), graph),
        bundleId,
        files,
        server,
      });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    }
  }

  async function applyOkfImport(): Promise<void> {
    if (!okfPreview) return;
    setProposalBusy(true);
    setError(null);
    try {
      const result = await importOkfModel(okfPreview.bundleId, okfPreview.files);
      setOkfPreview(null);
      setReloadToken((token) => token + 1);
      setNotice(`${result.receipts.length} OKF model declarations receipted by the registry.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setProposalBusy(false);
    }
  }

  async function restoreRightVersion(): Promise<void> {
    if (!rightVersion || !topicId) return;
    setProposalBusy(true);
    setError(null);
    try {
      const result = await postSchemaRestore(topicId, rightVersion.id, host);
      setDeclared(result.declared);
      setReloadToken((token) => token + 1);
      setNotice(
        `Restored schema ${String(rightVersion.version)} as a new receipted declaration batch.`,
      );
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : String(restoreError));
    } finally {
      setProposalBusy(false);
    }
  }

  async function exportOkf(): Promise<void> {
    const title = topicId ? `Model ${topicId}` : 'Model';
    const bundleId = title.toLocaleLowerCase().replaceAll(/\s+/g, '-');
    setProposalBusy(true);
    setError(null);
    try {
      const bundle = await exportOkfModel(bundleId);
      const href = URL.createObjectURL(new Blob([JSON.stringify(bundle.files, null, 2)], {
        type: 'application/json',
      }));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${bundle.bundle_id}.okf.json`;
      anchor.click();
      URL.revokeObjectURL(href);
      setNotice(`${bundle.object_count} registry object types exported through rustyred-thg-okf.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setProposalBusy(false);
    }
  }

  const versionById = new Map(declared.versions.map((version) => [version.id, version]));
  const [leftVersionId, rightVersionId] = diffVersionIds;
  const leftVersion = versionById.get(leftVersionId);
  const rightVersion = versionById.get(rightVersionId);

  const lensProps = {
    observed,
    declared,
    selection: queryState.selection,
    pendingPins: queryState.pendingPins,
    onSelect: (selection: ModelSelection | null) => {
      dispatch({ type: 'select', selection });
    },
    onPin: (observedKey: string, kind: PinKind, parentObservedKey?: string) => {
      void applyPin(observedKey, kind, parentObservedKey);
    },
    onUnpin: (declaredId: string) => {
      void applyUnpin(declaredId);
    },
    layoutPositions,
    onLayoutChange: (positions: LayoutPositions) => {
      scheduleLayoutPersist(positions);
    },
  };
  const unavailableMessage = !topicId
    ? 'Select a topic to load the observed model.'
    : error
      ? error
      : null;

  return (
    <div
      className="relative h-full min-h-0 bg-ij-editor"
      data-model-canvas-page
      data-register-impl="model-canvas.owox"
    >
      <div className="absolute inset-0 min-h-0">
        {loading && topicId ? (
          <div className="flex h-full items-center justify-center text-ij-ink-info">
            Loading observed model.
          </div>
        ) : (
          <DiagramLens {...lensProps} />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex max-w-md flex-col gap-1">
          {topicId ? (
            <p className="rounded-ij-arc bg-ij-chrome/90 px-2 py-1 font-ij-mono text-xs text-ij-ink-info backdrop-blur" data-mono-ok>
              topic:{topicId} · {observed.eventCount} events
            </p>
          ) : null}
          {unavailableMessage ? (
            <p className="rounded-ij-arc border border-ij-control-border bg-ij-chrome/95 px-3 py-2 text-sm text-ij-ink" role="status">
              {unavailableMessage}
              {error ? (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setReloadToken((token) => token + 1)}
                >
                  Retry
                </button>
              ) : null}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-ij-arc bg-ij-selection/95 px-3 py-2 text-sm text-ij-ink" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-ij-arc border border-ij-control-border bg-ij-chrome/95 p-1 shadow-sm backdrop-blur">
          <label className="flex h-ij-control cursor-pointer items-center rounded-ij-arc px-3 text-ij-ink hover:bg-ij-hover-surface">
            Import OKF
            <input
              type="file"
              accept=".md,.json,text/markdown,application/json"
              multiple
              className="sr-only"
              onChange={(event) => void previewOkfImport(event.target.files)}
            />
          </label>
          <button
            type="button"
            onClick={() => void exportOkf()}
            disabled={proposalBusy || declared.objectTypes.length === 0}
            className="h-ij-control rounded-ij-arc px-3 text-ij-ink hover:bg-ij-hover-surface disabled:opacity-50"
          >
            Export OKF
          </button>
          <button
            type="button"
            onClick={() => setProposalComposerOpen((open) => !open)}
            className="h-ij-control rounded-ij-arc px-3 text-ij-ink hover:bg-ij-hover-surface"
          >
            Propose
          </button>
          {declared.versions.length >= 2 ? (
            <>
              <select
                aria-label="Earlier schema version"
                value={leftVersionId}
                onChange={(event) => setDiffVersionIds([event.target.value, rightVersionId])}
                className="h-ij-control max-w-28 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-xs text-ij-ink"
              >
                <option value="">Earlier</option>
                {declared.versions.map((version) => (
                  <option key={version.id} value={version.id}>{String(version.version)}</option>
                ))}
              </select>
              <select
                aria-label="Later schema version"
                value={rightVersionId}
                onChange={(event) => setDiffVersionIds([leftVersionId, event.target.value])}
                className="h-ij-control max-w-28 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-xs text-ij-ink"
              >
                <option value="">Later</option>
                {declared.versions.map((version) => (
                  <option key={version.id} value={version.id}>{String(version.version)}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!leftVersion || !rightVersion || leftVersionId === rightVersionId}
                onClick={() => setDiffOpen(true)}
                className="h-ij-control rounded-ij-arc px-3 hover:bg-ij-hover-surface disabled:opacity-50"
              >
                Diff
              </button>
              <button
                type="button"
                disabled={proposalBusy || !rightVersion}
                onClick={() => void restoreRightVersion()}
                className="h-ij-control rounded-ij-arc px-3 hover:bg-ij-hover-surface disabled:opacity-50"
              >
                Restore
              </button>
            </>
          ) : null}
        </div>
      </div>

      {proposalComposerOpen ? (
        <div className="absolute bottom-3 left-3 right-3 z-30 mx-auto max-w-xl rounded-ij-arc border border-ij-control-border bg-ij-chrome/95 p-3 shadow-lg backdrop-blur">
          <form className="grid gap-2" onSubmit={(event) => void requestProposal(event)}>
            <label htmlFor="schema-proposal-request" className="grid gap-1 text-xs text-ij-ink-info">
              Schema change
              <textarea
                id="schema-proposal-request"
                value={proposalRequest}
                onChange={(event) => setProposalRequest(event.target.value)}
                placeholder="Declare customer email as a field"
                className="min-h-20 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 py-2 text-sm text-ij-ink focus:outline-2 focus:outline-ij-accent"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={proposalBusy || !proposalRequest.trim()}
                className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright hover:bg-ij-accent-hover disabled:opacity-50"
              >
                Propose
              </button>
              <button
                type="button"
                onClick={() => setProposalComposerOpen(false)}
                className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {proposal ? (
        <div className="absolute bottom-3 left-3 right-3 z-30 mx-auto max-w-2xl overflow-hidden rounded-ij-arc border border-ij-control-border bg-ij-chrome/95 shadow-lg backdrop-blur">
          <ProposalCard
            draft={proposal}
            busy={proposalBusy}
            onAccept={() => void acceptProposal()}
            onDecline={() => setProposal(null)}
          />
        </div>
      ) : null}

      {okfPreview ? (
        <div className="absolute bottom-3 left-3 right-3 z-30 mx-auto max-w-2xl rounded-ij-arc border border-ij-control-border bg-ij-selection/95 p-3 shadow-lg backdrop-blur" aria-label="OKF import preview">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-ij-ink">
              OKF dry run: {okfPreview.diff.tables.added.length} tables added,
              {' '}{okfPreview.diff.tables.removed.length} removed, and
              {' '}{okfPreview.diff.fields.length} field groups changed.
              {' '}{okfPreview.server.changes.length} Rust model-profile declarations checked.
            </p>
            <button
              type="button"
              disabled={proposalBusy || !okfPreview.server.validation.conformant}
              onClick={() => void applyOkfImport()}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
            >
              Confirm import
            </button>
            <button
              type="button"
              disabled={proposalBusy}
              onClick={() => setOkfPreview(null)}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
            >
              Cancel
            </button>
          </div>
          {okfPreview.server.changes.some((change) => change.status === 'conflict') ? (
            <p className="mt-2 text-xs text-ij-warn">
              Registry conflicts: {
                okfPreview.server.changes
                  .filter((change) => change.status === 'conflict')
                  .map((change) => change.concept_id)
                  .join(', ')
              }
            </p>
          ) : null}
        </div>
      ) : null}

      {diffOpen && leftVersion && rightVersion ? (
        <DiffDialog
          prev={declaredToModelGraph(declared, leftVersion)}
          next={declaredToModelGraph(declared, rightVersion)}
          label={`schema ${String(leftVersion.version)} to ${String(rightVersion.version)}`}
          onClose={() => setDiffOpen(false)}
        />
      ) : null}
    </div>
  );
}
