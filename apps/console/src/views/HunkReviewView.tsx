'use client';

// SOURCING: @codemirror/merge (MergeView), @commonplace/block-view
// (ViewDescriptor/BlockHost). One registered renderer for all five typed Hunk
// sources; Rust owns review logic and this view emits named host actions only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useAppearance } from '@/lib/appearance-store';
import type {
  BlockHost,
  ObjectActionReceipt,
  ObjectSet,
  Result,
  ViewRenderProps,
} from '@commonplace/block-view/types';
import { intuiEditorExtensions } from './cm-register-theme';
import { ViewState } from './ViewStates';
import {
  HUNK_REVIEW_ACTION_EVENT,
  hunkExecutorAction,
  type HunkReviewAction,
} from './hunks/hunk-actions';
import {
  hunkFromObject,
  type HunkStructuredValue,
  type HunkViewModel,
} from './hunks/hunk-contract';

const SOURCE_COPY: Record<HunkViewModel['source'], string> = {
  AgentRun: 'Agent run review',
  Briefing: 'Morning briefing',
  Recalc: 'Belief revision',
  AppInstall: 'App install preview',
  SchemaDraft: 'Schema draft',
};

type ActionStatus = 'idle' | 'working' | 'accepted' | 'failed';

function HunkTextMerge({ before, after }: { readonly before: string; readonly after: string }) {
  const { resolvedMode } = useAppearance();
  const parentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!parentRef.current) return;
    const readOnly = [
      ...intuiEditorExtensions(resolvedMode),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ];
    const merge = new MergeView({
      a: { doc: before, extensions: readOnly },
      b: { doc: after, extensions: readOnly },
      parent: parentRef.current,
      orientation: 'a-b',
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 2, minSize: 6 },
    });
    return () => merge.destroy();
  }, [after, before, resolvedMode]);
  return (
    <div
      ref={parentRef}
      className="min-h-44 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor"
      data-testid="hunk-text-merge"
    />
  );
}

function StructuredValue({
  spec,
  fallback,
  host,
}: {
  readonly spec?: HunkStructuredValue;
  readonly fallback: string;
  readonly host: BlockHost;
}) {
  const [set, setSet] = useState<ObjectSet | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!spec) return;
    let active = true;
    Promise.resolve(host.query(spec.query))
      .then((next) => {
        if (active) setSet(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [host, spec]);

  if (!spec) {
    return <pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap font-ij-mono text-ij-ink">{fallback}</pre>;
  }
  if (failed) return <ViewState state="error" errorMessage="Structured diff query failed." />;
  if (!set) return <ViewState state="loading" />;
  const descriptor = host.viewsFor(set.shape).find((candidate) => candidate.id === spec.descriptorId);
  if (!descriptor) return <ViewState state="unavailable" capability={`view ${spec.descriptorId}`} />;
  const Render = descriptor.render;
  return <Render set={set} host={host} />;
}

function ActionButton({
  children,
  primary = false,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly primary?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright hover:bg-ij-accent-hover'
          : 'h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface'
      }
    >
      {children}
    </button>
  );
}

export function HunkReviewView({ set, host }: ViewRenderProps) {
  const hunks = useMemo(
    () => set.objects.map(hunkFromObject).filter((hunk): hunk is HunkViewModel => hunk !== null),
    [set.objects],
  );
  const [grouped, setGrouped] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [humanAccept, setHumanAccept] = useState<ReadonlySet<string>>(new Set());
  const [statuses, setStatuses] = useState<Readonly<Record<string, ActionStatus>>>({});
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const safeActiveIndex = Math.min(activeIndex, Math.max(hunks.length - 1, 0));

  const hunkIndexMap = useMemo(
    () => new Map(hunks.map((hunk, i) => [hunk.hunkId, i])),
    [hunks],
  );

  const groups = useMemo(() => {
    if (!grouped) return hunks.map((hunk) => [hunk.hunkId, [hunk]] as const);
    const groupedHunks = new Map<string, HunkViewModel[]>();
    for (const hunk of hunks) {
      const key = hunk.groupId ?? hunk.targetBlock;
      groupedHunks.set(key, [...(groupedHunks.get(key) ?? []), hunk]);
    }
    return [...groupedHunks.entries()];
  }, [grouped, hunks]);

  const emitAction = useCallback(
    async (
      action: HunkReviewAction,
      targets: readonly HunkViewModel[],
      options: { readonly humanDischarge?: boolean } = {},
    ) => {
      if (targets.length === 0) return;
      const statusKey = targets.length === 1 ? targets[0].hunkId : `group:${targets[0].groupId ?? targets[0].targetBlock}`;
      setStatuses((current) => ({ ...current, [statusKey]: 'working' }));
      const result: Result<ObjectActionReceipt> = await host.emit(
        hunkExecutorAction(action, targets, options),
      );
      setStatuses((current) => ({ ...current, [statusKey]: result.ok ? 'accepted' : 'failed' }));
    },
    [host],
  );

  const runActiveAction = useCallback(
    (action: HunkReviewAction) => {
      const active = hunks[safeActiveIndex];
      if (!active) return;
      if (action === 'accept' && active.discharge === 'undischarged' && !humanAccept.has(active.hunkId)) {
        setHumanAccept((current) => new Set(current).add(active.hunkId));
        return;
      }
      void emitAction(action, [active], {
        humanDischarge: action === 'accept' && active.discharge === 'undischarged',
      });
    },
    [emitAction, humanAccept, hunks, safeActiveIndex],
  );

  useEffect(() => {
    const listener = (event: Event) => {
      const action = (event as CustomEvent<{ action?: HunkReviewAction }>).detail?.action;
      if (action) runActiveAction(action);
    };
    window.addEventListener(HUNK_REVIEW_ACTION_EVENT, listener);
    return () => window.removeEventListener(HUNK_REVIEW_ACTION_EVENT, listener);
  }, [runActiveAction]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const key = event.key.toLowerCase();
    if (!['j', 'k', 'a', 'r', 'v', 'e'].includes(key)) return;
    event.preventDefault();
    if (key === 'j' || key === 'k') {
      const direction = key === 'j' ? 1 : -1;
      const next = Math.max(0, Math.min(safeActiveIndex + direction, Math.max(hunks.length - 1, 0)));
      setActiveIndex(next);
      cardRefs.current.get(hunks[next]?.hunkId ?? '')?.focus();
      return;
    }
    const action = ({ a: 'accept', r: 'reject', v: 'verify', e: 'edit' } as const)[key as 'a' | 'r' | 'v' | 'e'];
    runActiveAction(action);
  };

  if (hunks.length === 0) return <ViewState state="empty" />;

  return (
    <section
      aria-label="Hunk review"
      aria-keyshortcuts="J K A R V E"
      className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink outline-none"
      data-testid="hunk-review"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-4 py-2">
        <div className="min-w-0">
          <div className="text-ij-ink-info">Review changes</div>
          <h2 className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Hunks <span className="text-ij-ink-info">{hunks.length}</span>
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Hunk view mode">
          {(['grouped', 'flat'] as const).map((mode) => {
            const pressed = mode === 'grouped' ? grouped : !grouped;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={pressed}
                onClick={() => setGrouped(mode === 'grouped')}
                className="h-ij-control rounded-ij-arc px-3 text-ij-ink-info hover:bg-ij-hover-surface aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
              >
                {mode === 'grouped' ? 'Grouped' : 'Flat'}
              </button>
            );
          })}
        </div>
      </header>
      <div className="shrink-0 border-b border-ij-seam bg-ij-chrome px-4 py-1 font-ij-mono text-ij-ink-info">
        j/k move · a accept · r reject · v verify · e edit
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3" role="list">
        <div className="mx-auto grid max-w-5xl gap-3">
          {groups.map(([groupId, group]) => {
            const blocked = group.some((hunk) => hunk.discharge === 'undischarged');
            const groupStatus = statuses[`group:${groupId}`] ?? 'idle';
            return (
              <section key={groupId} aria-label={`Hunk group ${groupId}`} className="grid gap-2">
                {grouped ? (
                  <div className="flex items-center gap-2 border-b border-ij-divider px-1 py-1 text-ij-ink-info">
                    <span className="truncate font-ij-mono">{groupId}</span>
                    <span className="ml-auto">{group.length} changes</span>
                    {group.length > 1 ? (
                      <ActionButton
                        primary
                        onClick={() => void emitAction(blocked ? 'verify' : 'accept', group)}
                      >
                        {blocked ? 'Verify group' : 'Accept group'}
                      </ActionButton>
                    ) : null}
                    {groupStatus !== 'idle' ? <span data-action-status={groupStatus}>{groupStatus}</span> : null}
                  </div>
                ) : null}
                {group.map((hunk) => {
                  const index = hunkIndexMap.get(hunk.hunkId) ?? -1;
                  const active = index === safeActiveIndex;
                  const status = statuses[hunk.hunkId] ?? 'idle';
                  const showHuman = humanAccept.has(hunk.hunkId);
                  return (
                    <article
                      key={hunk.hunkId}
                      ref={(node) => {
                        if (node) cardRefs.current.set(hunk.hunkId, node);
                        else cardRefs.current.delete(hunk.hunkId);
                      }}
                      role="listitem"
                      tabIndex={-1}
                      onFocus={() => setActiveIndex(index)}
                      data-active={active ? 'true' : undefined}
                      data-discharge={hunk.discharge}
                      data-source={hunk.source}
                      className="grid gap-3 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-3 outline-none data-[active]:border-ij-accent data-[active]:bg-ij-raised"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '240px' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0">
                          <div className="text-ij-ink-info">{SOURCE_COPY[hunk.source]}</div>
                          <h3 className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                            {hunk.title ?? hunk.targetBlock}
                          </h3>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {hunk.capabilityClass ? (
                            <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-2 font-ij-mono text-ij-ink-info">
                              {hunk.capabilityClass}
                            </span>
                          ) : null}
                          <span
                            className={
                              hunk.discharge === 'undischarged'
                                ? 'rounded-ij-arc-underline bg-ij-warn-bg px-2 text-ij-warn'
                                : 'rounded-ij-arc-underline bg-ij-ok-bg px-2 text-ij-ok'
                            }
                          >
                            {hunk.discharge}
                          </span>
                        </div>
                      </div>
                      {hunk.derivationRefs.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ij-arc bg-ij-editor px-3 py-2 text-ij-ink-info" aria-label="Semiring support dial">
                          <span>{hunk.semiring.supported ? 'supported' : 'unsupported'}</span>
                          <span>{hunk.semiring.independentLines} independent lines</span>
                          <span>weakest {hunk.semiring.weakestLink ?? 'unreported'}</span>
                          <span>
                            confidence {hunk.semiring.confidence === undefined ? 'unreported' : hunk.semiring.confidence.toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                      {hunk.beforeText !== undefined && hunk.afterText !== undefined ? (
                        <HunkTextMerge before={hunk.beforeText} after={hunk.afterText} />
                      ) : (
                        <div className="grid min-h-24 grid-cols-2 gap-px overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-divider">
                          <div className="min-w-0 bg-ij-editor p-3">
                            <div className="mb-2 text-ij-ink-info">Before</div>
                            <StructuredValue spec={hunk.beforeStructured} fallback={hunk.beforeRef ?? 'No prior value'} host={host} />
                          </div>
                          <div className="min-w-0 bg-ij-editor p-3">
                            <div className="mb-2 text-ij-ink-info">After</div>
                            <StructuredValue spec={hunk.afterStructured} fallback={hunk.afterRef} host={host} />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2" aria-label={`Actions for ${hunk.hunkId}`}>
                        {hunk.discharge === 'undischarged' ? (
                          <ActionButton primary onClick={() => void emitAction('verify', [hunk])}>Verify</ActionButton>
                        ) : (
                          <ActionButton primary onClick={() => void emitAction('accept', [hunk])}>Accept</ActionButton>
                        )}
                        {hunk.discharge === 'undischarged' && !showHuman ? (
                          <ActionButton onClick={() => setHumanAccept((current) => new Set(current).add(hunk.hunkId))}>
                            Show human accept
                          </ActionButton>
                        ) : null}
                        {hunk.discharge === 'undischarged' && showHuman ? (
                          <ActionButton onClick={() => void emitAction('accept', [hunk], { humanDischarge: true })}>
                            Accept as human
                          </ActionButton>
                        ) : null}
                        <ActionButton onClick={() => void emitAction('reject', [hunk])}>Reject</ActionButton>
                        <ActionButton onClick={() => void emitAction('edit', [hunk])}>Edit</ActionButton>
                        {status !== 'idle' ? <span className="text-ij-ink-info" data-action-status={status}>{status}</span> : null}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
