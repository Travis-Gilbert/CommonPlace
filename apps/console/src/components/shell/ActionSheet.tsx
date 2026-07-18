'use client';

// SOURCING: motion (motion/react; the sheet entrance is an inventory row) +
// zustand stores (shell + thread; With me stages visible refs into the
// thread). The action sheet (HANDOFF-CARDS-ACTIONS-MENTIONS K3/K4): instruction plus
// staged context, and context is never silent. All three entries (/do in the
// composer, the todo-block action icon, the Action verb on inspector and
// cards) open this same sheet. Staged chips show exactly what travels;
// auto-suggest adds visible removable chips through a real title query (the
// exact tier of the salience machinery reachable from the console today);
// the submitted pack equals the visible chip set exactly.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { BlockHost } from '@commonplace/block-view/types';
import {
  useShellStore,
  type StagedContextChip,
} from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import {
  buildActionPack,
  packEqualsChips,
  type ActionDestination,
  type ActionFollowUp,
} from '@/lib/action-pack';
import { DUR, EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';

type SubmitState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'done'; readonly message: string };

export function ActionSheet({ host }: { host: BlockHost }) {
  const origin = useShellStore((state) => state.actionSheetOrigin);
  const close = useShellStore((state) => state.closeActionSheet);
  if (!origin) return null;
  return <ActionSheetOpen key={origin.chips[0]?.id ?? 'blank'} host={host} onClose={close} />;
}

function ActionSheetOpen({ host, onClose }: { host: BlockHost; onClose: () => void }) {
  const origin = useShellStore((state) => state.actionSheetOrigin);
  const stageInThread = useThreadStore((state) => state.stage);
  const durations = useMotionDurations();
  const [instruction, setInstruction] = useState(origin?.instruction ?? '');
  const [chips, setChips] = useState<readonly StagedContextChip[]>(origin?.chips ?? []);
  const [destination, setDestination] = useState<ActionDestination>('for-me');
  const [followUp, setFollowUp] = useState<ActionFollowUp>('keep-open');
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  const [suggesting, setSuggesting] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    fieldRef.current?.focus();
    return () => prevFocus.current?.focus();
  }, []);

  const removeChip = useCallback((id: string) => {
    setChips((current) => current.filter((chip) => chip.id !== id));
  }, []);

  /** Auto-suggest (named choice 4): candidates come from a real title query
   *  against the seam (the exact tier reachable from the console; the full
   *  salience machinery is the harness's). Every added chip is visible and
   *  removable; nothing submits unseen. */
  const suggest = useCallback(async () => {
    const probe = instruction.trim().split(/\s+/).filter((word) => word.length > 3)[0];
    if (!probe) return;
    setSuggesting(true);
    try {
      const set = await host.query({
        types: ['record', 'person', 'task', 'project', 'org'],
        where: { kind: 'contains', field: 'title', value: probe },
        page: { limit: 5 },
      });
      setChips((current) => {
        const seen = new Set(current.map((chip) => chip.objectId));
        const added = set.objects
          .filter((object) => !seen.has(object.id))
          .slice(0, 3)
          .map(
            (object): StagedContextChip => ({
              id: `chip-auto-${object.id}`,
              kind: 'object',
              label: String(object.properties.title ?? object.id),
              objectId: object.id,
              objectType: object.type,
              source: 'auto',
            }),
          );
        return [...current, ...added];
      });
    } catch {
      // No candidates reachable: the chip list simply does not grow.
    } finally {
      setSuggesting(false);
    }
  }, [host, instruction]);

  const submitSheet = useCallback(async () => {
    const pack = buildActionPack(instruction, chips, destination, followUp);
    // The named invariant of the round: the pack equals the visible chips.
    if (!packEqualsChips(pack, chips)) {
      setSubmit({ kind: 'refused', message: 'pack drifted from the visible chips; not submitting' });
      return;
    }
    if (destination === 'with-me') {
      // With me stays console-local (K4): chips become visible object
      // references staged above the thread composer, and focus moves there.
      stageInThread(
        chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          objectId: chip.objectId,
        })),
      );
      onClose();
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLTextAreaElement>('[data-thread-composer-input]')
          ?.focus();
      });
      return;
    }
    setSubmit({ kind: 'submitting' });
    try {
      const response = await fetch('/api/harness/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pack),
      });
      if (response.ok) {
        setSubmit({ kind: 'done', message: 'handed off: the room appears in the strip' });
        return;
      }
      const message =
        response.status === 404
          ? 'the harness delegate wire is not configured (CONSOLE_HARNESS_URL)'
          : response.status === 401 || response.status === 403
            ? 'the harness refused this identity; With me still works'
            : `the harness declined the handoff (${response.status})`;
      setSubmit({ kind: 'refused', message });
    } catch {
      setSubmit({ kind: 'refused', message: 'the harness is unreachable; With me still works' });
    }
  }, [instruction, chips, destination, followUp, stageInThread, onClose]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Action sheet"
        data-action-sheet
        initial={durations.reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          // Reduced motion renders the sheet without the material animation
          // (K3 acceptance): a plain fade, no scale.
          duration: seconds(durations.reduced ? DUR.fast : durations.fast),
          ease: EASE_OUT,
        }}
        className="mt-24 w-full max-w-xl overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised"
      >
        <div className="border-b border-ij-divider p-3">
          <textarea
            ref={fieldRef}
            rows={2}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submitSheet();
              }
            }}
            placeholder="What should the agent do?"
            aria-label="Instruction"
            className="w-full resize-none rounded-ij-arc border border-ij-control-border bg-ij-editor px-3 py-1 text-ij-ink placeholder:text-ij-ink-disabled focus:outline-2 focus:outline-ij-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-ij-divider p-3" data-staged-context>
          {chips.map((chip) => (
            <span
              key={chip.id}
              data-context-chip={chip.source}
              className="inline-flex h-6 items-center gap-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
            >
              <span className="text-ij-ink-info">{chip.kind}</span>
              <span className="max-w-48 truncate">{chip.label}</span>
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                onClick={() => removeChip(chip.id)}
                className="text-ij-ink-info hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => void suggest()}
            disabled={suggesting}
            data-auto-suggest
            className="inline-flex h-6 items-center rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            {suggesting ? 'Suggesting…' : '+ Suggest context'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-ij-divider p-3">
          <div role="radiogroup" aria-label="Destination" className="flex overflow-hidden rounded-ij-arc border border-ij-control-border">
            {(
              [
                ['for-me', 'For me'],
                ['with-me', 'With me'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={destination === value}
                onClick={() => setDestination(value)}
                data-destination={value}
                className={
                  destination === value
                    ? 'h-ij-control bg-ij-selection px-3 text-ij-ink'
                    : 'h-ij-control bg-ij-editor px-3 text-ij-ink-info hover:bg-ij-hover-surface'
                }
                style={{ transition: 'var(--rec-clickable-transition)' }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-ij-ink-info">
            <input
              type="checkbox"
              checked={followUp === 'mark-handled'}
              onChange={(event) => setFollowUp(event.target.checked ? 'mark-handled' : 'keep-open')}
            />
            Mark handled after
          </label>
          <span
            className="text-ij-ink-disabled"
            title="Saving as a rule needs the rules engine (IX6), which is not built yet."
            data-save-as-rule-unavailable
          >
            Save as rule (needs IX6)
          </span>
        </div>

        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => void submitSheet()}
            disabled={submit.kind === 'submitting' || !instruction.trim()}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover focus:outline-2 focus:outline-ij-accent disabled:opacity-50"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            {destination === 'for-me' ? 'Hand off' : 'Stage in thread'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-ij-control rounded-ij-arc px-3 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            Cancel
          </button>
          {submit.kind === 'refused' ? (
            <span data-delegate-refused className="text-ij-error">
              {submit.message}
            </span>
          ) : null}
          {submit.kind === 'done' ? (
            <span data-delegate-done className="text-ij-ink-info">
              {submit.message}
            </span>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
