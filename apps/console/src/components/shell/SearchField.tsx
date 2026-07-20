'use client';

// SOURCING: cmdk (ledger row: search everywhere and palettes). Search owns
// Command, Search, and Objects as a keyboard-opened panel (no durable toolbar
// field). Generative input lives only in the Composer. Double Shift opens
// Search and Ctrl or Cmd K opens Command.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { motion } from 'motion/react';
import type { ObjectRef } from '@commonplace/block-view/types';
import {
  extractTheoremAddress,
  parseTheoremUri,
  theoremUri,
  THEOREM_SCHEME,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import { useShellStore, type SearchFieldMode } from '@/lib/shell-store';
import { SURFACE_ID } from '@/lib/workspace-seed';
import { APPEARANCE_PRESETS, selectAppearancePreset, setAppearancePreference, type ThemeMode } from '@/lib/appearance-store';
import { DUR, EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';
import { dispatchHunkReviewAction, HUNK_REVIEW_ACTIONS } from '@/views/hunks/hunk-actions';
import type { ConsoleBlockHost } from '@/lib/console-host';

const DOUBLE_SHIFT_MS = 400;
const MODES: readonly { id: SearchFieldMode; label: string; hint: string }[] = [
  { id: 'command', label: 'Command', hint: '>' },
  { id: 'search', label: 'Search', hint: 'Shift Shift' },
  { id: 'objects', label: 'Objects', hint: '@' },
];

interface ConsoleCommand {
  readonly id: string;
  readonly label: string;
  run(): void;
}

/** What the field makes of its text: an address to resolve, a refusal to
 *  show, or null for ordinary search text. */
type AddressProbe =
  | { readonly ok: true; readonly address: TheoremAddress }
  | { readonly ok: false; readonly message: string };

/**
 * Sniff a `theorem://` address out of the field (DESIGN-THEOREM-URI section 3).
 *
 * An address is an object reference, not a title fragment, so a substring
 * search over titles would find nothing and say nothing. A malformed one is an
 * absence with a reason, and a well-formed one belonging to another tenant is
 * refused here rather than resolved: addresses name, they never grant.
 */
function probeAddress(raw: string, tenant: string): AddressProbe | null {
  // The objects lane's `@` prefix is a mode sigil, not part of the address.
  const text = raw.trimStart().startsWith('@') ? raw.trimStart().slice(1) : raw;
  if (!text.includes(THEOREM_SCHEME)) return null;
  // Share-sheet text ("<title>\n<address>") pastes whole; the address is found
  // inside it rather than demanded bare.
  const address = extractTheoremAddress(text);
  if (address) {
    return address.tenant === tenant
      ? { ok: true, address }
      : {
          ok: false,
          message: `that address names tenant ${address.tenant}; this console is ${tenant}`,
        };
  }
  const token = text.trim().split(/\s+/).find((part) => part.startsWith(THEOREM_SCHEME));
  const parsed = token ? parseTheoremUri(token) : null;
  return {
    ok: false,
    message:
      parsed && !parsed.ok ? parsed.refusal.message : 'that text carries no theorem address',
  };
}

export function SearchPanel({ host }: { host: ConsoleBlockHost }) {
  const open = useShellStore((state) => state.searchPanelOpen);
  const mode = useShellStore((state) => state.searchFieldMode);
  const openSearchPanel = useShellStore((state) => state.openSearchPanel);
  const closeSearchPanel = useShellStore((state) => state.closeSearchPanel);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const toggleReducedMotionPreview = useShellStore((state) => state.toggleReducedMotionPreview);
  const tenant = useShellStore((state) => state.tenant);
  const durations = useMotionDurations();
  const [text, setText] = useState('');
  const [layout, setLayout] = useState<readonly ObjectRef[]>([]);
  const [objects, setObjects] = useState<readonly ObjectRef[]>([]);
  /** The object an addressed id resolved to, when this console holds it. Null
   *  means the address still opens by id; the inspector fetches it. */
  const [addressMatch, setAddressMatch] = useState<ObjectRef | null>(null);
  const addressProbe = useMemo(() => probeAddress(text, tenant), [text, tenant]);
  const previousFocus = useRef<HTMLElement | null>(null);
  const lastShift = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const restoreFocus = useCallback(() => {
    const target = previousFocus.current;
    previousFocus.current = null;
    if (target && document.contains(target)) target.focus();
  }, []);

  const close = useCallback(() => {
    closeSearchPanel();
  }, [closeSearchPanel]);

  useEffect(() => {
    if (!open && previousFocus.current) requestAnimationFrame(restoreFocus);
  }, [open, restoreFocus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!open) previousFocus.current = document.activeElement as HTMLElement | null;
        openSearchPanel('command');
        return;
      }
      if (event.key !== 'Shift' || event.ctrlKey || event.metaKey || event.altKey) return;
      const now = performance.now();
      if (now - lastShift.current < DOUBLE_SHIFT_MS) {
        lastShift.current = 0;
        if (!open) previousFocus.current = document.activeElement as HTMLElement | null;
        openSearchPanel('search');
      } else {
        lastShift.current = now;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openSearchPanel]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.resolve(host.query(surfaceQuery())).then((set) => {
      if (active) setLayout(set.objects);
    });
    return () => {
      active = false;
    };
  }, [host, open]);

  // An addressed object resolves by id, not by title. One bounded query names
  // it so the item reads as the object rather than as a raw id, and so the
  // inspector opens without a second fetch.
  useEffect(() => {
    if (!open || !addressProbe?.ok) return;
    const address = addressProbe.address;
    let active = true;
    Promise.resolve(host.query({
      types: [...new Set([address.kind, 'record'])],
      where: { kind: 'eq', field: 'id', value: address.id },
      page: { limit: 4 },
    })).then((set) => {
      if (active) setAddressMatch(set.objects.find((object) => object.id === address.id) ?? null);
    }).catch(() => {
      if (active) setAddressMatch(null);
    });
    return () => {
      active = false;
    };
  }, [addressProbe, host, open]);

  useEffect(() => {
    if (!open || mode === 'command') return;
    // Address text is a reference, never a title fragment: the title search
    // would find nothing, so it does not run.
    if (addressProbe) return;
    const token = mode === 'objects' ? text.replace(/^@/, '') : text;
    if (mode === 'search' && token.trim().length < 2) return;
    let active = true;
    Promise.resolve(host.query({
      types: ['record', 'person', 'task', 'project', 'org', 'doc'],
      where: token.trim() ? { kind: 'contains', field: 'title', value: token.trim() } : undefined,
      page: { limit: 16 },
    })).then((set) => {
      if (active) setObjects(set.objects);
    }).catch(() => {
      if (active) setObjects([]);
    });
    return () => {
      active = false;
    };
  }, [addressProbe, host, mode, open, text]);

  useEffect(() => {
    if (open) {
      if (!previousFocus.current) previousFocus.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, mode]);

  const surfaces = useMemo(() => layout.filter((object) => object.type === 'surface'), [layout]);
  const commands = useMemo<readonly ConsoleCommand[]>(() => {
    const objectById = new Map(layout.map((object) => [object.id, object]));
    const activeSurface = surfaces.find((surface) => surface.properties.active === true) ?? objectById.get(SURFACE_ID);
    const companionCommands = (activeSurface?.relations?.CONTAINS ?? [])
      .map((id) => objectById.get(id))
      .filter((object): object is ObjectRef => object?.type === 'region' && object.properties.role === 'companion')
      .map((region): ConsoleCommand => ({
        id: `toggle:${region.id}`,
        label: `Toggle ${String(region.properties.title)} companion`,
        run: () => void host.setRegionOpen(region.id, region.properties.open === false),
      }));
    const surfaceCommands = surfaces.map((surface): ConsoleCommand => ({
      id: `surface:${surface.id}`,
      label: `Switch layout: ${String(surface.properties.name ?? surface.id)}`,
      run: () => void host.activateSurface(surface.id),
    }));
    const presetCommands = APPEARANCE_PRESETS.map((preset): ConsoleCommand => ({
      id: `appearance:${preset.id}`,
      label: `Set theme: ${preset.label}`,
      run: () => selectAppearancePreset(preset.id),
    }));
    const modeCommands = (['auto', 'dark', 'light'] as const).map((themeMode: ThemeMode): ConsoleCommand => ({
      id: `appearance-mode:${themeMode}`,
      label: `Set appearance mode: ${themeMode}`,
      run: () => setAppearancePreference({ mode: themeMode }),
    }));
    const hunkCommands = activeSurface?.properties.kind === 'review'
      ? HUNK_REVIEW_ACTIONS.map((command): ConsoleCommand => ({
          id: command.id,
          label: command.label,
          run: () => dispatchHunkReviewAction(command.action),
        }))
      : [];
    return [
      ...companionCommands,
      ...surfaceCommands,
      ...hunkCommands,
      ...presetCommands,
      ...modeCommands,
      {
        id: 'motion-preview',
        label: 'Toggle reduced motion preview',
        run: toggleReducedMotionPreview,
      },
    ];
  }, [host, layout, surfaces, toggleReducedMotionPreview]);

  const filteredCommands = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return needle ? commands.filter((command) => command.label.toLowerCase().includes(needle)) : commands;
  }, [commands, text]);
  const visibleObjects =
    addressProbe || (mode === 'search' && text.trim().length < 2) ? [] : objects;
  /** The addressed object when this console holds it and it still matches the
   *  text; a stale match never labels a newer address. */
  const resolved =
    addressProbe?.ok && addressMatch && addressMatch.id === addressProbe.address.id
      ? addressMatch
      : null;

  const chooseObject = (object: ObjectRef) => {
    selectRecord(object.id, object, object.type);
    setText('');
    close();
  };

  /** Resolve an address straight to its object: identity lives in the id, and
   *  the kind rides along as the fetch hint. */
  const chooseAddress = (address: TheoremAddress) => {
    selectRecord(address.id, resolved, address.kind);
    setText('');
    close();
  };

  const onValueChange = (value: string) => {
    if (value.startsWith('>')) {
      setText(value.slice(1));
      openSearchPanel('command');
      return;
    }
    if (value.startsWith('@')) openSearchPanel('objects');
    // An address is an object reference: the field moves to the objects lane
    // so it resolves instead of filtering command labels.
    else if (mode === 'command' && value.includes(THEOREM_SCHEME)) openSearchPanel('objects');
    setText(value);
  };

  const itemClass = 'flex min-h-ij-row cursor-default items-center gap-2 rounded-ij-arc-underline px-2 text-ij-ink data-[selected=true]:bg-ij-selection';

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) close();
      }}
      label="Search"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-transparent"
      contentClassName="fixed inset-x-0 top-0 z-50 mx-auto w-144 max-w-full outline-none"
    >
      <motion.div
        data-search-panel
        initial={durations.reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: durations.reduced ? 0 : seconds(DUR.fast), ease: EASE_OUT }}
        className="mt-1 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised"
      >
        <div className="flex items-center gap-1 border-b border-ij-divider px-2 pt-2 pb-1">
          {MODES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => openSearchPanel(candidate.id)}
              aria-pressed={mode === candidate.id}
              data-search-mode={candidate.id}
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
        <Command.Input
          ref={inputRef}
          value={text}
          onValueChange={onValueChange}
          placeholder={mode === 'command' ? 'Run a command' : mode === 'objects' ? '@ object' : 'Search records and documents'}
          className="h-ij-control w-full border-b border-ij-divider bg-transparent px-3 text-ij-ink outline-none placeholder:text-ij-ink-disabled"
        />
        <Command.List className="max-h-96 overflow-y-auto p-2">
          {mode === 'command' ? filteredCommands.map((command) => (
            <Command.Item
              key={command.id}
              value={command.label}
              onSelect={() => {
                command.run();
                setText('');
                close();
              }}
              className={itemClass}
            >
              {command.label}
            </Command.Item>
          )) : addressProbe ? (
            addressProbe.ok ? (
              <Command.Item
                key="theorem-address"
                data-address-resolve
                value={theoremUri(addressProbe.address)}
                onSelect={() => chooseAddress(addressProbe.address)}
                className={itemClass}
              >
                <span className="truncate">
                  Open {resolved ? String(resolved.properties.title ?? resolved.id) : addressProbe.address.id}
                </span>
                <span className="ml-auto font-ij-mono text-ij-ink-disabled">
                  {addressProbe.address.kind}
                </span>
              </Command.Item>
            ) : (
              // A malformed or foreign address says so; it never silently
              // does nothing.
              <div className="p-3 text-ij-error" data-address-refusal>
                {addressProbe.message}
              </div>
            )
          ) : visibleObjects.map((object) => (
            <Command.Item
              key={object.id}
              value={`${String(object.properties.title ?? object.id)} ${object.type}`}
              onSelect={() => chooseObject(object)}
              className={itemClass}
            >
              <span className="truncate">{String(object.properties.title ?? object.id)}</span>
              <span className="ml-auto font-ij-mono text-ij-ink-disabled">{object.type}</span>
            </Command.Item>
          ))}
          {mode !== 'command' && !addressProbe && visibleObjects.length === 0 ? (
            <Command.Empty className="p-3 text-ij-ink-info">
              {text.trim().length < 2 && mode === 'search' ? 'Type two characters to search.' : 'No matching objects.'}
            </Command.Empty>
          ) : null}
        </Command.List>
      </motion.div>
    </Command.Dialog>
  );
}
