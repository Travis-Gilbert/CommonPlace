'use client';

// SOURCING: cmdk (ledger row: search everywhere, palettes). Double Shift
// opens; scoped tabs (All, Records, Views); the selected scope row sits on
// --ij-selection per the Int UI selection treatment.

import { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'motion/react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { seconds, useMotionDurations, EASE_OUT } from '@/motion/motion-tokens';

type Scope = 'all' | 'records' | 'views';
const SCOPES: readonly { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'records', label: 'Records' },
  { id: 'views', label: 'Views' },
];

const DOUBLE_SHIFT_MS = 400;

export function SearchEverywhere({ host }: { host: BlockHost }) {
  const open = useShellStore((state) => state.searchOpen);
  const setOpen = useShellStore((state) => state.setSearchOpen);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const durations = useMotionDurations();
  const [scope, setScope] = useState<Scope>('all');
  const [text, setText] = useState('');
  const [records, setRecords] = useState<readonly ObjectRef[]>([]);
  const lastShift = useRef(0);

  // Double Shift: two bare Shift presses within the window.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Shift' || event.ctrlKey || event.metaKey || event.altKey) return;
      const now = performance.now();
      if (now - lastShift.current < DOUBLE_SHIFT_MS) {
        setOpen(true);
        lastShift.current = 0;
      } else {
        lastShift.current = now;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (!open || text.length < 2 || scope === 'views') {
      setRecords([]);
      return;
    }
    let active = true;
    Promise.resolve(
      host.query({
        types: ['record'],
        where: { kind: 'contains', field: 'title', value: text },
        page: { limit: 12 },
      }),
    ).then((set) => {
      if (active) setRecords(set.objects);
    });
    return () => {
      active = false;
    };
  }, [open, text, scope, host]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="absolute inset-0 z-50" role="presentation" onClick={() => setOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: seconds(durations.fast), ease: EASE_OUT }}
            className="mx-auto mt-24 w-144 max-w-full overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <Command label="Search everywhere" shouldFilter={scope !== 'records'}>
              <div className="flex items-center gap-1 border-b border-ij-divider px-2 pt-2">
                {SCOPES.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setScope(candidate.id)}
                    aria-pressed={scope === candidate.id}
                    className="rounded-ij-arc-underline px-3 py-1 text-ij-ink-info aria-pressed:text-ij-ink"
                    style={{
                      background: scope === candidate.id ? 'var(--ij-selection)' : 'transparent',
                      transition: 'var(--rec-clickable-transition)',
                    }}
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
              <Command.Input
                value={text}
                onValueChange={setText}
                autoFocus
                placeholder="Search everywhere"
                className="h-ij-toolbar w-full bg-ij-raised px-3 text-ij-ink outline-none placeholder:text-ij-ink-disabled"
              />
              <Command.List className="max-h-80 overflow-y-auto p-1">
                <Command.Empty className="p-3 text-ij-ink-info">No matches.</Command.Empty>
                {(scope === 'all' || scope === 'views') && (
                  <Command.Group heading="Views" className="text-ij-ink-info">
                    {CONSOLE_VIEW_REGISTRY.descriptors.map((descriptor) => (
                      <Command.Item
                        key={descriptor.id}
                        value={`${descriptor.name} ${descriptor.id}`}
                        onSelect={() => setOpen(false)}
                        className="flex h-ij-row cursor-default items-center rounded-ij-arc-underline px-2 text-ij-ink data-[selected=true]:bg-ij-selection"
                      >
                        {descriptor.name}
                        <span className="ml-2 font-ij-mono text-ij-ink-info">{descriptor.id}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {(scope === 'all' || scope === 'records') && records.length > 0 && (
                  <Command.Group heading="Records" className="text-ij-ink-info">
                    {records.map((record) => (
                      <Command.Item
                        key={record.id}
                        value={record.id}
                        onSelect={() => {
                          selectRecord(record.id);
                          setOpen(false);
                        }}
                        className="flex h-ij-row cursor-default items-center rounded-ij-arc-underline px-2 text-ij-ink data-[selected=true]:bg-ij-selection"
                      >
                        {String(record.properties.title ?? record.id)}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
