'use client';

// SOURCING: cmdk (ledger row: search everywhere, palettes; one engine for the
// island's four modes). The omnibar is the console's primary input
// (HANDOFF-CONSOLE-ROUND-2 R1, named choices 1 through 4): collapsed it is a
// quiet single line field in the toolbar center; focused it expands into an
// island over the editor top. Modes: Ask (default, routes to the one ambient
// thread runtime), Command (">" prefix), Search (the absorbed Search
// Everywhere), Objects ("@" inserts typed reference chips resolved through
// the block-view host). Double Shift opens Search (JetBrains muscle memory);
// Ctrl or Cmd L opens Ask (Cursor muscle memory); Escape collapses and
// restores focus to the prior element.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'motion/react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import { useShellStore, type OmnibarMode } from '@/lib/shell-store';
import { useThreadStore, chatEndpoint } from '@/lib/thread-store';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { seconds, useMotionDurations, EASE_OUT, DUR } from '@/motion/motion-tokens';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { SURFACE_ID } from '@/lib/workspace-seed';

const DOUBLE_SHIFT_MS = 400;

const MODES: readonly { id: OmnibarMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: 'plain text' },
  { id: 'command', label: 'Command', hint: '>' },
  { id: 'search', label: 'Search', hint: 'Shift Shift' },
  { id: 'objects', label: 'Objects', hint: '@' },
];

type SearchScope = 'all' | 'records' | 'views' | 'runs' | 'memory' | 'rooms';
const SEARCH_SCOPES: readonly { id: SearchScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'records', label: 'Records' },
  { id: 'views', label: 'Views' },
  { id: 'runs', label: 'Runs' },
  { id: 'memory', label: 'Memory' },
  { id: 'rooms', label: 'Rooms' },
];

/** A typed object reference the Objects mode inserts into the Ask input. */
interface ObjectChip {
  readonly id: string;
  readonly title: string;
  readonly type: string;
}

interface ConsoleCommand {
  readonly id: string;
  readonly label: string;
  /** When set, the command renders disabled with this reason and never runs. */
  readonly unavailable?: string;
  run?(): void;
}

/** The collapsed toolbar field, and the quiet streaming chip that replaces it
 *  while a run is live (named choice 4). */
export function OmnibarField() {
  const openOmnibar = useShellStore((state) => state.openOmnibar);
  const isRunning = useThreadStore((state) => state.isRunning);

  if (isRunning) {
    return (
      <button
        type="button"
        data-omnibar-chip
        aria-label="Reply streaming; open the omnibar"
        onClick={() => openOmnibar('ask')}
        className="flex h-ij-control w-full max-w-144 items-center gap-2 rounded-ij-arc border border-ij-control-border bg-ij-chrome px-3 text-ij-ink-info"
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        <PresenceMark state="composing" size={16} />
        <span className="truncate">Streaming reply in the thread</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-omnibar-field
      aria-label="Ask; Ctrl+L in desktop opens Ask, Shift Shift opens Search"
      aria-keyshortcuts="Meta+L Control+L"
      onClick={() => openOmnibar('ask')}
      className="flex h-ij-control w-full max-w-144 items-center rounded-ij-arc border border-ij-control-border bg-ij-chrome px-3 text-left text-ij-ink-disabled hover:border-ij-seam-raised hover:text-ij-ink-info"
      style={{ transition: 'var(--rec-clickable-transition)' }}
    >
      Ask · Ctrl+L desktop · Shift Shift searches
    </button>
  );
}

export function OmnibarIsland({ host }: { host: BlockHost }) {
  const open = useShellStore((state) => state.omnibarOpen);
  const mode = useShellStore((state) => state.omnibarMode);
  const openOmnibar = useShellStore((state) => state.openOmnibar);
  const closeOmnibar = useShellStore((state) => state.closeOmnibar);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const toggleReducedMotionPreview = useShellStore((state) => state.toggleReducedMotionPreview);
  const send = useThreadStore((state) => state.send);
  const cancel = useThreadStore((state) => state.cancel);
  const isRunning = useThreadStore((state) => state.isRunning);
  const messages = useThreadStore((state) => state.messages);
  const durations = useMotionDurations();

  const [text, setText] = useState('');
  const [chips, setChips] = useState<readonly ObjectChip[]>([]);
  const [scope, setScope] = useState<SearchScope>('all');
  const [records, setRecords] = useState<readonly ObjectRef[]>([]);
  const [objects, setObjects] = useState<readonly ObjectRef[]>([]);
  const [layout, setLayout] = useState<readonly ObjectRef[]>([]);
  const [runs, setRuns] = useState<readonly { id: string }[] | 'unavailable' | null>(null);
  const lastShift = useRef(0);
  const prevFocus = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const endpoint = chatEndpoint();

  const close = useCallback(() => {
    closeOmnibar();
    const target = prevFocus.current;
    prevFocus.current = null;
    if (target && document.contains(target)) target.focus();
  }, [closeOmnibar]);

  // Global keys: double Shift opens Search; Ctrl or Cmd L opens Ask (the
  // Cursor muscle-memory key from named choice 3, live in the desktop shell).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === 'l' || event.key === 'L') &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        if (!open) prevFocus.current = document.activeElement as HTMLElement | null;
        openOmnibar('ask');
        return;
      }
      if (event.key !== 'Shift' || event.ctrlKey || event.metaKey || event.altKey) return;
      const now = performance.now();
      if (now - lastShift.current < DOUBLE_SHIFT_MS) {
        lastShift.current = 0;
        if (!open) prevFocus.current = document.activeElement as HTMLElement | null;
        openOmnibar('search');
      } else {
        lastShift.current = now;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openOmnibar]);

  // Capture the prior focus when the island opens by pointer (field click).
  useEffect(() => {
    if (open && !prevFocus.current) {
      const active = document.activeElement as HTMLElement | null;
      prevFocus.current = active && active !== document.body ? active : null;
    }
  }, [open]);

  // The arrangement objects back the Command mode (tool window toggles,
  // layout switching) and the Ask submit's thread reveal.
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.resolve(host.query(surfaceQuery())).then((set) => {
      if (active) setLayout(set.objects);
    });
    return () => {
      active = false;
    };
  }, [open, host, mode]);

  // Record search (Search mode) and object resolution (Objects mode) run the
  // same host seam with different projections.
  // Stale results never render: the search list gates on text length and
  // scope at render time, so effects only fetch (no sync state clearing).
  const objectsToken = mode === 'objects' ? text.slice(text.lastIndexOf('@') + 1) : '';
  useEffect(() => {
    if (!open) return;
    const wantRecords = mode === 'search' && text.length >= 2 && (scope === 'all' || scope === 'records');
    const wantObjects = mode === 'objects';
    if (!wantRecords && !wantObjects) return;
    let active = true;
    if (wantRecords) {
      Promise.resolve(
        host.query({
          types: ['record'],
          where: { kind: 'contains', field: 'title', value: text },
          page: { limit: 12 },
        }),
      ).then((set) => {
        if (active) setRecords(set.objects);
      });
    }
    if (wantObjects) {
      const token = objectsToken;
      Promise.resolve(
        host.query({
          types: ['record'],
          where: token ? { kind: 'contains', field: 'title', value: token } : undefined,
          page: { limit: 8 },
        }),
      ).then((set) => {
        if (active) setObjects(set.objects);
      });
    }
    return () => {
      active = false;
    };
  }, [open, mode, text, scope, host, objectsToken]);

  // Runs are harness-sourced (R2.5): the scope lists real runs through the
  // console proxy, or names its unavailability when the harness is not wired.
  useEffect(() => {
    if (!open || mode !== 'search' || scope !== 'runs' || runs !== null) return;
    let active = true;
    void fetch('/api/harness/runs', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setRuns('unavailable');
          return;
        }
        const payload = (await response.json()) as { runs?: { run_id?: string; runId?: string }[] };
        setRuns(
          (payload.runs ?? [])
            .map((run) => ({ id: run.run_id ?? run.runId ?? '' }))
            .filter((run) => run.id),
        );
      })
      .catch(() => {
        if (active) setRuns('unavailable');
      });
    return () => {
      active = false;
    };
  }, [open, mode, scope, runs]);

  const threadRegion = useMemo(() => {
    const instances = new Set(
      layout
        .filter(
          (object) =>
            object.type === 'view-instance' && object.properties.descriptor_id === 'chat.thread',
        )
        .map((object) => object.id),
    );
    return layout.find(
      (object) =>
        object.type === 'region' &&
        (object.relations?.CONTAINS ?? []).some((childId) => instances.has(childId)),
    );
  }, [layout]);

  const submitAsk = useCallback(() => {
    const message = [chips.map((chip) => `@${chip.id}`).join(' '), text]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!message || !endpoint || isRunning) return;
    if (threadRegion && threadRegion.properties.open === false) {
      void host.emit({ kind: 'update', id: threadRegion.id, patch: { open: true } });
    }
    void send(message);
    setText('');
    setChips([]);
    close();
  }, [chips, text, endpoint, isRunning, threadRegion, host, send, close]);

  // Mode routing on input change: ">" from Ask enters Command, "@" enters
  // Objects; both preserve the typed text (acceptance: mid-composition mode
  // switches never lose text).
  const onValueChange = (value: string) => {
    if (mode === 'ask' && value.startsWith('>')) {
      setText(value.slice(1));
      openOmnibar('command');
      return;
    }
    if ((mode === 'ask' || mode === 'search') && value.endsWith('@')) {
      setText(value);
      openOmnibar('objects');
      return;
    }
    setText(value);
  };

  const insertChip = (object: ObjectRef) => {
    const anchor = text.lastIndexOf('@');
    setText(anchor >= 0 ? text.slice(0, anchor) : text);
    setChips((current) =>
      current.some((chip) => chip.id === object.id)
        ? current
        : [
            ...current,
            { id: object.id, title: String(object.properties.title ?? object.id), type: object.type },
          ],
    );
    openOmnibar('ask');
  };

  const surfaces = useMemo(
    () => layout.filter((object) => object.type === 'surface'),
    [layout],
  );

  const commands = useMemo<ConsoleCommand[]>(() => {
    // Tool window toggles derive from the ACTIVE surface's own regions, so
    // the command list always matches the stripes on screen.
    const objectById = new Map(layout.map((object) => [object.id, object]));
    const activeSurface =
      layout.find((object) => object.type === 'surface' && object.properties.active === true) ??
      objectById.get(SURFACE_ID);
    const toggles = (activeSurface?.relations?.CONTAINS ?? [])
      .map((regionId) => objectById.get(regionId))
      .filter(
        (region): region is ObjectRef =>
          !!region && region.type === 'region' && region.properties.kind === 'tool-window',
      )
      .map((region): ConsoleCommand => ({
        id: `toggle:${region.id}`,
        label: `Toggle ${String(region.properties.title ?? region.id)} tool window`,
        run: () => {
          void host.emit({
            kind: 'update',
            id: region.id,
            patch: { open: region.properties.open === false },
          });
        },
      }));
    const layoutSwitches = surfaces
      .filter((surface) => surfaces.length > 1)
      .map((surface): ConsoleCommand => ({
        id: `layout:${surface.id}`,
        label: `Switch layout: ${String(surface.properties.name ?? surface.id)}`,
        run: () => {
          for (const candidate of surfaces) {
            void host.emit({
              kind: 'update',
              id: candidate.id,
              patch: { active: candidate.id === surface.id },
            });
          }
        },
      }));
    return [
      ...toggles,
      ...layoutSwitches,
      isRunning
        ? { id: 'run:stop', label: 'Stop the live run', run: () => cancel() }
        : {
            id: 'run:start',
            label: 'Run',
            unavailable: 'no runs source is wired this round; the widget stays empty',
          },
      {
        id: 'settings',
        label: 'Open settings',
        unavailable: 'no settings surface is seeded this round',
      },
      {
        id: 'motion:preview',
        label: 'Toggle reduced motion preview',
        run: () => toggleReducedMotionPreview(),
      },
    ];
  }, [layout, surfaces, host, isRunning, cancel, toggleReducedMotionPreview]);

  const filteredCommands = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return needle
      ? commands.filter((command) => command.label.toLowerCase().includes(needle))
      : commands;
  }, [commands, text]);

  const filteredViews = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return CONSOLE_VIEW_REGISTRY.descriptors.filter(
      (descriptor) =>
        !needle ||
        descriptor.name.toLowerCase().includes(needle) ||
        descriptor.id.toLowerCase().includes(needle),
    );
  }, [text]);

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

  const itemClass =
    'flex min-h-ij-row cursor-default items-center gap-2 rounded-ij-arc-underline px-2 text-ij-ink data-[selected=true]:bg-ij-selection';

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="absolute inset-x-0 top-0 z-50 h-full"
          role="presentation"
          onClick={close}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              if (mode === 'objects') {
                openOmnibar('ask');
                return;
              }
              close();
            }
          }}
        >
          <motion.div
            data-omnibar-island
            initial={durations.reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              // Reduced motion renders the expansion as a plain fade (R1
              // acceptance); DUR.fast either way, scale only when unreduced.
              duration: seconds(durations.reduced ? DUR.fast : durations.fast),
              ease: EASE_OUT,
            }}
            className="mx-auto mt-1 w-144 max-w-full overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised"
            onClick={(event) => event.stopPropagation()}
          >
            <Command label="Omnibar" shouldFilter={false} loop>
              {/* Mode row: the active mode is visible in the island chrome at
                  all times (named choice 2). */}
              <div className="flex items-center gap-1 border-b border-ij-divider px-2 pt-2 pb-1">
                {MODES.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => openOmnibar(candidate.id)}
                    aria-pressed={mode === candidate.id}
                    data-omnibar-mode={candidate.id}
                    className="whitespace-nowrap rounded-ij-arc-underline px-3 py-1 text-ij-ink-info aria-pressed:text-ij-ink"
                    style={{
                      background: mode === candidate.id ? 'var(--ij-selection)' : 'transparent',
                      transition: 'var(--rec-clickable-transition)',
                    }}
                  >
                    {candidate.label}
                    <span className="ml-1 font-ij-mono text-ij-ink-disabled">{candidate.hint}</span>
                  </button>
                ))}
              </div>

              {chips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 px-3 pt-2">
                  {chips.map((chip) => (
                    <span
                      key={chip.id}
                      data-object-chip={chip.id}
                      className="inline-flex items-center gap-1 rounded-ij-arc-underline bg-ij-row-blue px-2 leading-5 text-ij-link"
                    >
                      @{chip.title}
                      <button
                        type="button"
                        aria-label={`Remove reference ${chip.title}`}
                        onClick={() =>
                          setChips((current) => current.filter((candidate) => candidate.id !== chip.id))
                        }
                        className="text-ij-ink-info hover:text-ij-ink"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <Command.Input
                ref={inputRef}
                value={text}
                onValueChange={onValueChange}
                autoFocus
                placeholder={
                  mode === 'ask'
                    ? 'Ask the harness'
                    : mode === 'command'
                      ? 'Run a command'
                      : mode === 'search'
                        ? 'Search everywhere'
                        : 'Reference an object'
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && mode === 'ask') {
                    event.preventDefault();
                    submitAsk();
                  }
                }}
                className="h-ij-toolbar w-full bg-ij-raised px-3 text-ij-ink outline-none placeholder:text-ij-ink-disabled"
              />

              {mode === 'search' ? (
                <div className="flex items-center gap-1 border-b border-ij-divider px-2 pb-1">
                  {SEARCH_SCOPES.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setScope(candidate.id)}
                      aria-pressed={scope === candidate.id}
                      className="rounded-ij-arc-underline px-2 py-0.5 text-ij-ink-info aria-pressed:text-ij-ink"
                      style={{
                        background: scope === candidate.id ? 'var(--ij-selection)' : 'transparent',
                        transition: 'var(--rec-clickable-transition)',
                      }}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <Command.List className="max-h-80 overflow-y-auto p-1">
                {mode === 'ask' ? (
                  <div className="px-2 py-2 text-ij-ink-info">
                    {endpoint ? (
                      <>
                        <div>Enter asks the harness; the thread streams the reply.</div>
                        {lastAssistant && lastAssistant.parts[0]?.text ? (
                          <div className="mt-2 truncate border-t border-ij-divider pt-2 text-ij-ink-disabled">
                            {lastAssistant.parts[0].text.slice(0, 140)}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div>
                        Unavailable: the harness chat endpoint (NEXT_PUBLIC_CONSOLE_CHAT_URL) is
                        not configured.
                      </div>
                    )}
                  </div>
                ) : null}

                {mode === 'command' ? (
                  <>
                    <Command.Empty className="p-3 text-ij-ink-info">No matching command.</Command.Empty>
                    {filteredCommands.map((command) =>
                      command.unavailable ? (
                        <div key={command.id} className="flex min-h-ij-row items-center gap-2 px-2 text-ij-ink-disabled">
                          {command.label}
                          <span className="truncate text-ij-ink-disabled">({command.unavailable})</span>
                        </div>
                      ) : (
                        <Command.Item
                          key={command.id}
                          value={command.id}
                          onSelect={() => {
                            command.run?.();
                            close();
                          }}
                          className={itemClass}
                        >
                          {command.label}
                        </Command.Item>
                      ),
                    )}
                  </>
                ) : null}

                {mode === 'search' ? (
                  <>
                    <Command.Empty className="p-3 text-ij-ink-info">No matches.</Command.Empty>
                    {(scope === 'all' || scope === 'views') && (
                      <Command.Group heading="Views" className="text-ij-ink-info">
                        {filteredViews.map((descriptor) => (
                          <Command.Item
                            key={descriptor.id}
                            value={`view:${descriptor.id}`}
                            onSelect={close}
                            className={itemClass}
                          >
                            {descriptor.name}
                            <span className="font-ij-mono text-ij-ink-info">{descriptor.id}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {(scope === 'all' || scope === 'records') && text.length >= 2 && records.length > 0 && (
                      <Command.Group heading="Records" className="text-ij-ink-info">
                        {records.map((record) => (
                          <Command.Item
                            key={record.id}
                            value={`record:${record.id}`}
                            onSelect={() => {
                              selectRecord(record.id);
                              close();
                            }}
                            className={itemClass}
                          >
                            {String(record.properties.title ?? record.id)}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {scope === 'runs' && (
                      Array.isArray(runs) && runs.length > 0 ? (
                        <Command.Group heading="Runs" className="text-ij-ink-info">
                          {runs.map((run) => (
                            <Command.Item key={run.id} value={`run:${run.id}`} onSelect={close} className={itemClass}>
                              <span className="font-ij-mono">{run.id}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      ) : (
                        <div className="p-3 text-ij-ink-info">
                          {runs === 'unavailable'
                            ? 'Unavailable: the harness runs source (CONSOLE_HARNESS_URL) is not configured.'
                            : Array.isArray(runs)
                              ? 'No runs.'
                              : 'Loading runs.'}
                        </div>
                      )
                    )}
                    {(scope === 'memory' || scope === 'rooms') && (
                      <div className="p-3 text-ij-ink-info">
                        {scope === 'memory'
                          ? 'Unavailable: harness memory search is not wired in the console.'
                          : 'Unavailable: coordination rooms are not wired in the console.'}
                      </div>
                    )}
                  </>
                ) : null}

                {mode === 'objects' ? (
                  <>
                    <Command.Empty className="p-3 text-ij-ink-info">No matching object.</Command.Empty>
                    {objects.map((object) => (
                      <Command.Item
                        key={object.id}
                        value={`object:${object.id}`}
                        onSelect={() => insertChip(object)}
                        className={itemClass}
                      >
                        <span className="font-ij-mono text-ij-ink-info">{object.type}</span>
                        {String(object.properties.title ?? object.id)}
                      </Command.Item>
                    ))}
                  </>
                ) : null}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
