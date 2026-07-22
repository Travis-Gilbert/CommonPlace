'use client';

// SOURCING: @tanstack/react-virtual for the semantic workspace tree and
// @codemirror/merge for revision diffs. The browser supplies a path input;
// the desktop shell can replace that field with its native directory picker.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Command } from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  addWorkspaceContentRoot,
  createWorkspaceProject,
  fetchFileHistory,
  fetchWorkspaceReadiness,
  fetchWorkspaceSurface,
  findInWorkspaceProject,
  readinessIsBuilding,
  restoreWorkspaceRevision,
  workspaceTreeRows,
  type FileHistory,
  type WorkspaceReadiness,
  type WorkspaceSearchHit,
  type WorkspaceSurfaceSnapshot,
  type WorkspaceTreeNode,
} from '@commonplace/theorem-acp/workspace-state';
import { WorkspaceHistoryDiff } from './WorkspaceHistoryDiff';

const POLL_MS = 1_500;
const PROJECT_STORAGE_KEY = 'commonplace.console.workspace.project.v1';

export function WorkspaceSubstrateView(_props: ViewRenderProps) {
  const [projectId, setProjectId] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [projectName, setProjectName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [surface, setSurface] = useState<WorkspaceSurfaceSnapshot | null>(null);
  const [readiness, setReadiness] = useState<WorkspaceReadiness | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<WorkspaceTreeNode | null>(null);
  const [history, setHistory] = useState<FileHistory | null>(null);
  const [historyPath, setHistoryPath] = useState('');
  const [findQuery, setFindQuery] = useState('');
  const [findHits, setFindHits] = useState<WorkspaceSearchHit[]>([]);
  const [findBusy, setFindBusy] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [selectedGenerations, setSelectedGenerations] = useState<readonly number[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastFindRef = useRef<{ query: string; projectId: string } | null>(null);
  const readinessSignatureRef = useRef('');

  useEffect(() => {
    const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (stored) setProjectId(stored);
  }, []);

  useEffect(() => {
    if (projectId) window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = projectId
          ? await fetchWorkspaceSurface(projectId, { signal: controller.signal })
          : null;
        const nextReadiness = next?.readiness
          ?? await fetchWorkspaceReadiness({ signal: controller.signal });
        if (stopped) return;
        setSurface(next);
        setReadiness(nextReadiness);
        if (next && expanded.size === 0) {
          setExpanded(new Set(next.tree.roots.map((root) => root.id)));
        }
        setStatus('live');
        setError(null);
      } catch (pollError) {
        if (stopped || controller.signal.aborted) return;
        setStatus('reconnecting');
        setError(pollError instanceof Error ? pollError.message : String(pollError));
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
      }
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [expanded.size, projectId]);

  const projection = useMemo(
    () => surface ? workspaceTreeRows(surface.tree, expanded) : { rows: [], nodeById: new Map() },
    [expanded, surface],
  );
  const virtualizer = useVirtualizer({
    count: projection.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });
  const effectiveActiveRowId = projection.rows.some((row) => row.id === activeRowId)
    ? activeRowId
    : projection.rows[0]?.id;
  const focusRow = (id: string) => {
    const index = projection.rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    setActiveRowId(id);
    virtualizer.scrollToIndex(index, { align: 'auto' });
    requestAnimationFrame(() => requestAnimationFrame(() => rowRefs.current.get(id)?.focus()));
  };
  const toggleRow = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const selectedRevisions = useMemo(
    () => history?.revisions
      .filter((revision) => selectedGenerations.includes(revision.generation))
      .sort((left, right) => left.generation - right.generation)
      .slice(-2) ?? [],
    [history, selectedGenerations],
  );

  const importRoot = useCallback(async () => {
    if (!rootPath.trim() || (!projectId && !projectName.trim())) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = projectId
        ? await addWorkspaceContentRoot(projectId, rootPath.trim())
        : await createWorkspaceProject(projectName.trim(), rootPath.trim());
      setProjectId(receipt.projectId);
      setRootPath('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setBusy(false);
    }
  }, [projectId, projectName, rootPath]);

  const loadHistory = useCallback(async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchFileHistory(path);
      setHistory(next);
      setSelectedGenerations(next.revisions.slice(-2).map((revision) => revision.generation));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : String(historyError));
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async (generation: number) => {
    if (!history) return;
    setBusy(true);
    setError(null);
    try {
      const next = await restoreWorkspaceRevision(history.path, generation);
      setHistory(next);
      setSelectedGenerations(next.revisions.slice(-2).map((revision) => revision.generation));
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : String(restoreError));
    } finally {
      setBusy(false);
    }
  }, [history]);

  const executeFind = useCallback(async (query: string, activeProjectId: string) => {
    setFindBusy(true);
    setError(null);
    try {
      setFindHits(await findInWorkspaceProject(query, activeProjectId));
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : String(findError));
      setFindHits([]);
    } finally {
      setFindBusy(false);
    }
  }, []);

  const runFind = useCallback(async () => {
    const query = findQuery.trim();
    if (!projectId || !query) return;
    lastFindRef.current = { query, projectId };
    await executeFind(query, projectId);
  }, [executeFind, findQuery, projectId]);

  const readinessSignature = readiness?.capabilities
    .map((capability) => `${capability.capability}:${capability.state}:${capability.missing.join(',')}`)
    .join('|') ?? '';
  useEffect(() => {
    const previous = readinessSignatureRef.current;
    readinessSignatureRef.current = readinessSignature;
    if (!previous || previous === readinessSignature || !lastFindRef.current) return;
    const active = lastFindRef.current;
    void executeFind(active.query, active.projectId);
  }, [executeFind, readinessSignature]);

  const building = readinessIsBuilding(readiness);
  return (
    <section className="flex h-full min-h-0 flex-col bg-transparent text-ij-ink" data-workspace-substrate>
      <section data-block-section="connect" className="shrink-0">
      <header className="flex items-center gap-3 border-b border-ij-seam px-4 py-2">
        <div className="min-w-0">
          <div className="text-ij-ink-info">Workspace substrate</div>
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {projectId || 'Import a project'}
          </h2>
        </div>
        <span className="ml-auto font-ij-mono text-ij-ink-info" data-workspace-poll={status}>
          {status}
        </span>
        {projectId ? (
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(PROJECT_STORAGE_KEY);
              setProjectId('');
              setSurface(null);
              setHistory(null);
              setFindHits([]);
              lastFindRef.current = null;
            }}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
          >
            Change project
          </button>
        ) : null}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={building
                ? 'h-ij-control rounded-ij-arc-underline bg-ij-warn-bg px-2 text-ij-warn'
                : 'h-ij-control rounded-ij-arc-underline bg-ij-ok-bg px-2 text-ij-ok'}
              data-readiness={building ? 'building' : 'ready'}
            >
              {building ? 'Building' : 'Ready'}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={6}
              align="end"
              aria-label="Readiness by capability"
              className="z-50 w-80 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-3 text-ij-ink shadow-xl"
            >
              <strong>Readiness by capability</strong>
              <ul className="mt-2 grid gap-1">
                {readiness?.capabilities.map((capability) => (
                  <li key={capability.capability} className="flex gap-2 border-b border-ij-divider py-1">
                    <span>{capability.capability}</span>
                    <span className="ml-auto text-ij-ink-info">
                      {capability.missing.length ? capability.missing.join(', ') : capability.state}
                    </span>
                  </li>
                ))}
              </ul>
              <Popover.Arrow className="fill-ij-raised" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-ij-seam px-3 py-2">
        {!projectId ? (
          <>
            <input
              value={projectInput}
              onChange={(event) => setProjectInput(event.target.value)}
              placeholder="Existing project id"
              aria-label="Existing project id"
              className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono text-ij-ink focus:outline-2 focus:outline-ij-accent"
            />
            <button
              type="button"
              disabled={!projectInput.trim()}
              onClick={() => setProjectId(projectInput.trim())}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface disabled:opacity-50"
            >
              Open project
            </button>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="New project name"
              aria-label="Project name"
              className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink focus:outline-2 focus:outline-ij-accent"
            />
          </>
        ) : null}
        <input
          value={rootPath}
          onChange={(event) => setRootPath(event.target.value)}
          placeholder="Absolute directory path"
          aria-label="Directory path"
          className="h-ij-control min-w-80 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono text-ij-ink focus:outline-2 focus:outline-ij-accent"
        />
        <button
          type="button"
          disabled={busy || !rootPath.trim() || (!projectId && !projectName.trim())}
          onClick={() => void importRoot()}
          className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright hover:bg-ij-accent-hover disabled:opacity-50"
        >
          {projectId ? 'Add content root' : 'Create project'}
        </button>
      </div>
      </section>

      <section data-block-section="browse" className="flex min-h-0 flex-1 flex-col">
      {projectId ? (
        <Command className="shrink-0 border-b border-ij-seam" shouldFilter={false}>
          <form
            className="flex items-center gap-2 px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runFind();
            }}
          >
            <Command.Input
              value={findQuery}
              onValueChange={setFindQuery}
              aria-label="Find in project"
              placeholder="Find in project"
              className="h-ij-control min-w-80 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
            />
            <button
              type="submit"
              disabled={findBusy || !findQuery.trim()}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
            >
              Find
            </button>
          </form>
          {findHits.length ? (
            <Command.List aria-label="Project Find results" className="max-h-36 overflow-auto border-t border-ij-divider px-2 py-1">
              {findHits.map((hit) => (
                <Command.Item
                  key={hit.item.id}
                  value={`${hit.item.title} ${hit.item.path ?? ''}`}
                  className="flex min-h-ij-row items-center gap-2 rounded-ij-arc-underline px-2 data-[selected=true]:bg-ij-selection"
                >
                  <span className="truncate">{hit.item.title}</span>
                  <span className="font-ij-mono text-ij-ink-info">{hit.item.kind}</span>
                  {hit.insideProject === true ? <span className="text-ij-ok">inside project</span> : null}
                  <span className="ml-auto font-ij-mono text-ij-ink-info">{hit.score.toFixed(3)}</span>
                  {hit.degraded ? (
                    <span className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn" data-find-degraded>
                      degraded: {hit.missingIndexes.join(', ')}
                    </span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.List>
          ) : null}
        </Command>
      ) : null}

      {error ? <div role="alert" className="border-b border-ij-seam bg-ij-error-bg px-3 py-2 text-ij-error">{error}</div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-3">
        <div className="col-span-2 grid min-h-0 grid-cols-2 border-r border-ij-seam">
        <div role="region" className="flex min-h-0 flex-col border-r border-ij-seam" aria-label="Project entity tree">
          <div className="border-b border-ij-seam px-3 py-2">
            <strong>Project model</strong>
            <div className="text-ij-ink-info">Generation {surface?.tree.generation ?? readiness?.generation ?? 0}</div>
          </div>
          <div ref={scrollRef} role="tree" className="min-h-0 flex-1 overflow-y-auto">
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = projection.rows[virtualRow.index];
                const open = expanded.has(row.id);
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="treeitem"
                    aria-level={row.depth}
                    aria-expanded={row.expandable ? open : undefined}
                    aria-selected={selected?.id === row.id}
                    tabIndex={row.id === effectiveActiveRowId ? 0 : -1}
                    ref={(node) => {
                      if (node) rowRefs.current.set(row.id, node);
                      else rowRefs.current.delete(row.id);
                    }}
                    onFocus={() => setActiveRowId(row.id)}
                    onClick={() => {
                      setSelected(row.node);
                      if (row.expandable) toggleRow(row.id);
                    }}
                    onKeyDown={(event) => {
                      const index = projection.rows.findIndex((entry) => entry.id === row.id);
                      if (event.key === 'ArrowDown' && index < projection.rows.length - 1) {
                        event.preventDefault();
                        focusRow(projection.rows[index + 1].id);
                      } else if (event.key === 'ArrowUp' && index > 0) {
                        event.preventDefault();
                        focusRow(projection.rows[index - 1].id);
                      } else if (event.key === 'Home' && projection.rows.length) {
                        event.preventDefault();
                        focusRow(projection.rows[0].id);
                      } else if (event.key === 'End' && projection.rows.length) {
                        event.preventDefault();
                        focusRow(projection.rows[projection.rows.length - 1].id);
                      } else if (event.key === 'ArrowRight' && row.expandable) {
                        event.preventDefault();
                        if (!open) toggleRow(row.id);
                        else if (projection.rows[index + 1]?.depth > row.depth) focusRow(projection.rows[index + 1].id);
                      } else if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        if (row.expandable && open) toggleRow(row.id);
                        else {
                          const parent = projection.rows.slice(0, index).reverse().find((candidate) => candidate.depth < row.depth);
                          if (parent) focusRow(parent.id);
                        }
                      }
                    }}
                    className="absolute left-0 flex h-ij-row w-full items-center pr-2 text-left text-ij-ink hover:bg-ij-hover-surface aria-selected:bg-ij-selection"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: `calc(var(--rec-grid) * ${row.depth * 3})`,
                      opacity: row.node.excluded ? 0.48 : 1,
                    }}
                  >
                    <span className="mr-1 w-3 text-ij-ink-disabled" aria-hidden>
                      {row.expandable ? open ? '▾' : '▸' : '·'}
                    </span>
                    <span className="truncate">{row.node.name}</span>
                    <span className="ml-auto font-ij-mono text-ij-ink-info">{row.node.kind}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div role="region" className="min-h-0 overflow-auto border-r border-ij-seam p-3" aria-label="Workspace entity details">
          <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Entity contract</h3>
          {selected ? (
            <dl className="mt-3 grid gap-2">
              <Detail label="Name" value={selected.name} />
              <Detail label="Kind" value={selected.kind} />
              <Detail label="Path" value={selected.path ?? 'No filesystem path'} />
              <Detail label="Scope" value={selected.excluded ? 'Excluded from indexes' : 'Inside project membrane'} />
              <Detail label="Entity id" value={selected.id} />
            </dl>
          ) : <p className="mt-3 text-ij-ink-info">Select a typed workspace entity.</p>}
          <div className="mt-4 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-3">
            <strong>Project membrane</strong>
            <p className="mt-1 text-ij-ink-info">Inside results are boosted. Outside results remain visible above the nonzero floor.</p>
          </div>
          <div className="mt-4">
            <strong>Readiness by capability</strong>
            <ul className="mt-2 grid gap-1">
              {readiness?.capabilities.map((capability) => (
                <li key={capability.capability} className="flex gap-2 border-b border-ij-divider py-1">
                  <span>{capability.capability}</span>
                  <span className="ml-auto text-ij-ink-info">
                    {capability.missing.length ? capability.missing.join(', ') : capability.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        </div>

        <div role="region" data-block-section="revise" className="flex min-h-0 flex-col" aria-label="Local history">
          <div className="border-b border-ij-seam px-3 py-2">
            <strong>Local history</strong>
            <div className="truncate font-ij-mono text-ij-ink-info">{history?.path ?? 'Select a file'}</div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (historyPath.trim()) void loadHistory(historyPath.trim());
              }}
            >
              <input
                value={historyPath}
                onChange={(event) => setHistoryPath(event.target.value)}
                aria-label="File history path"
                placeholder="Absolute file path"
                className="h-ij-control min-w-0 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono focus:outline-2 focus:outline-ij-accent"
              />
              <button
                type="submit"
                disabled={busy || !historyPath.trim()}
                className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface disabled:opacity-50"
              >
                History
              </button>
            </form>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <ol className="grid gap-1">
              {history?.revisions.slice().reverse().map((revision) => (
                <li key={`${revision.generation}:${revision.hash}`} className="flex items-center gap-2 border-b border-ij-divider py-1">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedGenerations.includes(revision.generation)}
                      onChange={() => setSelectedGenerations((current) => {
                        if (current.includes(revision.generation)) {
                          return current.filter((value) => value !== revision.generation);
                        }
                        return [...current, revision.generation].slice(-2);
                      })}
                    />
                    <span className="font-ij-mono">g{revision.generation}</span>
                    <span className="truncate text-ij-ink-info">{new Date(revision.timestampMs).toLocaleString()}</span>
                    {revision.label ? <span className="truncate text-ij-ink-info">{revision.label}</span> : null}
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(revision.generation)}
                    className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ol>
            {selectedRevisions.length === 2 && selectedRevisions.every((revision) => revision.content !== null) ? (
              <div className="mt-3">
                <WorkspaceHistoryDiff before={selectedRevisions[0]} after={selectedRevisions[1]} />
              </div>
            ) : selectedRevisions.length === 2 ? (
              <p className="mt-3 text-ij-warn">Diff unavailable for a binary or oversized revision.</p>
            ) : null}
          </div>
        </div>
      </div>
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-ij-divider pb-2">
      <dt className="text-ij-ink-info">{label}</dt>
      <dd className="break-words font-ij-mono">{value}</dd>
    </div>
  );
}
