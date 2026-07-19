'use client';

// SOURCING: the sheen canvas material is the surviving port of the 21st.dev
// muhammad-binsalman/glowing-ai-chat-assistant component supplied by Travis
// (see ComposerSheenCanvas). HANDOFF-CONSOLE-DIMENSIONALITY X1 subtracted the
// rest of that source's skeleton: the material container, translucent overlay,
// input wash, send glow, backdrop blur, character counter, footer row, and
// status text were the source's decoration laundered through a parallel token
// family, not this system's grammar. What remains is an instrument panel --
// --ij-raised surface, --ij-seam-raised border, arc radius, the sheen behind
// the content -- with @assistant-ui/react fitted into it. The floating
// launcher, close behavior, and right docking were already removed for the
// permanent lower-third placement required by HANDOFF-CONSOLE-IA.

import { useCallback, useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import {
  extractTheoremAddress,
  parseTheoremUri,
  theoremUri,
  THEOREM_SCHEME,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  unstable_useMentionAdapter,
  useComposerRuntime,
} from '@assistant-ui/react';
import { PresenceMark } from '@/components/mark/PresenceMark';
import {
  IconAttach,
  IconChevronDown,
  IconCommand,
  IconSend,
  IconStop,
} from '@/components/shell/icons';
import { objectAddress } from '@/lib/object-address';
import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import { ComposerSheenCanvas } from './ComposerSheenCanvas';

const MAX_CHARACTERS = 2000;
/** The counter is not ambient furniture: a live digit readout on every
 *  keystroke reports a limit nobody is near. It reappears only inside the
 *  final tenth of the budget, where the number is actually news (X1). */
const COUNTER_REVEAL_AT = MAX_CHARACTERS * 0.9;
/** The new-line hint lives on the send control and the first-run empty state
 *  (X1), so the composer needs no footer row to carry it. */
export const NEW_LINE_HINT = 'Shift + Enter for a new line';

function AttachmentChip() {
  return (
    <AttachmentPrimitive.Root className="inline-flex h-6 items-center gap-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink">
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove aria-label="Remove attachment" className="text-ij-ink-info hover:text-ij-ink">
        ×
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

export interface ComposerProps {
  readonly host: BlockHost;
  readonly compact?: boolean;
  readonly unavailable?: boolean;
  /** Backend-advertised capability. The server verifies this again per turn. */
  readonly webSearchAvailable?: boolean;
}

function useObjectMentionAdapter(objects: readonly ObjectRef[], tenant: string) {
  'use no memo';

  // A mention chip's identity is its canonical address (DESIGN-THEOREM-URI
  // section 3). The adapter's directive formatter serializes the item id as
  // `{name=<id>}`, so addressing the item addresses the inserted mention too:
  // one grammar, no second serializer. The graph id stays in `metadata` for
  // consumers that resolve locally.
  const items = useMemo(() => objects.map((object) => ({
    id: objectAddress(tenant, object),
    type: object.type,
    label: String(object.properties.title ?? object.properties.name ?? object.id),
    description: object.type,
    metadata: {
      objectId: object.id,
      objectType: object.type,
      address: objectAddress(tenant, object),
    },
  })), [objects, tenant]);

  return unstable_useMentionAdapter({ items, includeModelContextTools: false });
}

/** A pasted address waiting on the person's decision. Offer, never
 *  auto-insert: the precedent is the mobile Omnibar's paste detection. */
interface PastedAddress {
  readonly address: TheoremAddress;
  /** The clipboard text exactly as pasted, so "Paste as text" loses nothing. */
  readonly raw: string;
}

export function Composer({
  host,
  compact = false,
  unavailable = false,
  webSearchAvailable = false,
}: ComposerProps) {
  const isRunning = useThreadStore((state) => state.isRunning);
  const staged = useThreadStore((state) => state.staged);
  const stage = useThreadStore((state) => state.stage);
  const unstage = useThreadStore((state) => state.unstage);
  const mode = useThreadStore((state) => state.mode);
  const setMode = useThreadStore((state) => state.setMode);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const tenant = useShellStore((state) => state.tenant);
  const composerRuntime = useComposerRuntime();
  const [mentions, setMentions] = useState<readonly ObjectRef[]>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const [pasted, setPasted] = useState<PastedAddress | null>(null);
  const [pasteRefusal, setPasteRefusal] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve(host.query({
      types: ['person', 'task', 'project', 'org', 'doc', 'record'],
      page: { limit: 40 },
    })).then((set) => {
      if (active) setMentions(set.objects);
    }).catch(() => {
      if (active) setMentions([]);
    });
    return () => {
      active = false;
    };
  }, [host]);

  const mention = useObjectMentionAdapter(mentions, tenant);

  /** The label a pasted address gets: the object's own title when this console
   *  already holds it, otherwise its kind and id. Never a guess. */
  const labelForAddress = useCallback(
    (address: TheoremAddress) => {
      const known = mentions.find((object) => object.id === address.id);
      return known
        ? String(known.properties.title ?? known.properties.name ?? known.id)
        : `${address.kind} ${address.id}`;
    },
    [mentions],
  );

  /** Paste detection: offer, never auto-insert (the mobile Omnibar precedent).
   *  A pasted address is held out of the message until the person picks an
   *  outcome, so nothing silently turns into raw URI text or a chip. */
  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const text = event.clipboardData.getData('text/plain');
      if (!text) return;
      // Share sheets wrap an address in a title and a newline, so the address
      // is found inside the noise rather than demanded bare.
      const address = extractTheoremAddress(text);
      if (address && address.tenant === tenant) {
        event.preventDefault();
        setPasteRefusal(null);
        setPasted({ address, raw: text });
        return;
      }
      if (!text.includes(THEOREM_SCHEME)) return;
      // A near-miss address still pastes as plain text (nothing is lost) and
      // says why it did not become a chip. Addresses name; they never grant,
      // so another tenant's address is refused here rather than resolved.
      if (address) {
        setPasteRefusal(
          `that address names tenant ${address.tenant}; this console is ${tenant}`,
        );
        return;
      }
      const token = text.split(/\s+/).find((part) => part.startsWith(THEOREM_SCHEME));
      const parsed = token ? parseTheoremUri(token) : null;
      setPasteRefusal(
        parsed && !parsed.ok ? parsed.refusal.message : 'that text carries no theorem address',
      );
    },
    [tenant],
  );

  const acceptPastedChip = useCallback(() => {
    if (!pasted) return;
    // Re-emit through the shared helper so the staged chip carries the
    // canonical form of the address, not whatever spelling was pasted.
    const uri = theoremUri(pasted.address);
    stage([
      {
        id: `chip-address-${uri}`,
        label: labelForAddress(pasted.address),
        objectId: pasted.address.id,
        address: uri,
      },
    ]);
    setPasted(null);
  }, [labelForAddress, pasted, stage]);

  const keepPastedText = useCallback(() => {
    if (!pasted) return;
    // The paste was held, so the caret offset is gone: the text appends. The
    // person sees exactly what they copied, which is the point of the offer.
    const next = `${composerRuntime.getState().text}${pasted.raw}`;
    composerRuntime.setText(next);
    // The runtime write bypasses the textarea's change event, so the counter
    // is told directly rather than left reading a stale length.
    setCharacterCount(next.length);
    setPasted(null);
  }, [composerRuntime, pasted]);

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Unstable_TriggerPopover
        char="@"
        adapter={mention.adapter}
        aria-label="Object mentions"
        className="absolute bottom-full left-0 z-30 mb-1 max-h-64 w-full overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1"
      >
        <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
        <ComposerPrimitive.Unstable_TriggerPopoverItems>
          {(items) => items.map((item, index) => (
            <ComposerPrimitive.Unstable_TriggerPopoverItem
              key={item.id}
              item={item}
              index={index}
              className="flex h-ij-row w-full items-center rounded-ij-arc-underline px-2 text-left text-ij-ink data-[highlighted]:bg-ij-selection"
            >
              <span className="truncate">{item.label}</span>
              <span className="ml-auto font-ij-mono text-ij-ink-disabled">{item.type}</span>
            </ComposerPrimitive.Unstable_TriggerPopoverItem>
          ))}
        </ComposerPrimitive.Unstable_TriggerPopoverItems>
      </ComposerPrimitive.Unstable_TriggerPopover>

      <ComposerPrimitive.AttachmentDropzone className="relative">
        <ComposerPrimitive.Root
          data-composer
          data-composer-density={compact ? 'compact' : 'full'}
          data-source-component="21st-dev-glowing-ai-chat-assistant"
          className="composer-shell relative overflow-hidden border border-ij-seam-raised bg-ij-raised"
          onSubmit={() => setCharacterCount(0)}
        >
          <ComposerSheenCanvas streaming={isRunning} />
          <div className="relative z-10">
            {staged.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 border-b border-ij-seam px-2 pt-2" data-thread-staged>
                {staged.map((ref) => (
                  <span key={ref.id} data-thread-staged-ref className="inline-flex h-6 items-center gap-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink">
                    <span className="max-w-48 truncate">{ref.label}</span>
                    <button type="button" aria-label={`Remove ${ref.label}`} onClick={() => unstage(ref.id)} className="text-ij-ink-info hover:text-ij-ink">×</button>
                  </span>
                ))}
              </div>
            ) : null}
            {pasted ? (
              <div
                className="flex flex-wrap items-center gap-1 border-b border-ij-seam px-2 pt-2"
                data-composer-paste-offer
              >
                <span className="text-ij-ink-info">Pasted address</span>
                <span className="max-w-48 truncate text-ij-ink" data-paste-label>
                  {labelForAddress(pasted.address)}
                </span>
                <button
                  type="button"
                  data-paste-as-chip
                  onClick={acceptPastedChip}
                  className="inline-flex h-6 items-center rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent"
                  style={{ transition: 'var(--rec-clickable-transition)' }}
                >
                  Add as chip
                </button>
                <button
                  type="button"
                  data-paste-as-text
                  onClick={keepPastedText}
                  className="inline-flex h-6 items-center rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
                  style={{ transition: 'var(--rec-clickable-transition)' }}
                >
                  Paste as text
                </button>
                <button
                  type="button"
                  aria-label="Discard the pasted address"
                  onClick={() => setPasted(null)}
                  className="text-ij-ink-info hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
                >
                  ×
                </button>
              </div>
            ) : null}
            {pasteRefusal ? (
              <div className="flex items-center gap-1 border-b border-ij-seam px-2 pt-2" data-composer-paste-refusal>
                <span className="min-w-0 flex-1 truncate text-ij-error" title={pasteRefusal}>
                  {pasteRefusal}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss the address refusal"
                  onClick={() => setPasteRefusal(null)}
                  className="text-ij-ink-info hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
                >
                  ×
                </button>
              </div>
            ) : null}
            <ComposerPrimitive.Attachments components={{ Attachment: AttachmentChip }} />
            <div className="composer-input-section">
              <ComposerPrimitive.Input
                minRows={compact ? 2 : 4}
                maxRows={compact ? 4 : 8}
                maxLength={MAX_CHARACTERS}
                disabled={unavailable}
                data-composer-input
                data-thread-composer-input
                placeholder={unavailable ? 'Chat endpoint unavailable' : 'Message the harness. Use @ for objects or /do for an action.'}
                className="composer-input w-full resize-none bg-transparent text-ij-ink outline-none placeholder:text-ij-ink-disabled"
                onChange={(event) => setCharacterCount(event.currentTarget.value.length)}
                onPaste={onPaste}
              />
            </div>
            <div className="composer-controls-wrap border-t border-ij-seam">
              <div className="composer-controls">
                <div className="composer-tool-group" data-composer-tool-group>
                  <ComposerPrimitive.AddAttachment
                    aria-label="Attach file"
                    title="Upload files"
                    disabled={unavailable}
                    className="composer-icon-button"
                  >
                    <IconAttach size={16} />
                  </ComposerPrimitive.AddAttachment>
                  <button
                    type="button"
                    aria-label="Open action sheet"
                    title="Plan an action"
                    onClick={() => openActionSheet({ instruction: '', chips: [] })}
                    className="composer-icon-button"
                    style={{ transition: 'var(--rec-clickable-transition)' }}
                  >
                    <IconCommand size={16} />
                  </button>
                </div>
                <label className="composer-mode-control">
                  <span className="sr-only">Chat destination</span>
                  <select
                    aria-label="Chat destination"
                    data-web-search-state={webSearchAvailable ? 'available' : 'unavailable'}
                    value={mode}
                    onChange={(event) => setMode(event.target.value as 'theorem' | 'web')}
                    className="composer-mode-select"
                  >
                    <option value="theorem">Theorem</option>
                    <option value="web" disabled={!webSearchAvailable}>
                      Web search
                    </option>
                  </select>
                  <IconChevronDown size={13} className="composer-mode-chevron" />
                </label>
                {characterCount >= COUNTER_REVEAL_AT ? (
                  <span className="composer-character-count" data-composer-character-count aria-live="polite">
                    <span>{characterCount}</span>/<span>{MAX_CHARACTERS}</span>
                  </span>
                ) : null}
                {/* The one Presence mark. The compact and footer duplicates
                    collapsed here (X1): the mark is the status, which is its
                    entire job, so the "ready" status text it used to sit
                    beside is gone. The web-search capability still needs a
                    reachable attribute, and it belongs on the control that
                    actually selects the destination. */}
                <span className="composer-presence" data-presence-mark-placement="composer">
                  <PresenceMark state={isRunning ? 'composing' : 'idle'} size={22} staticOnly />
                </span>
                {isRunning ? (
                  <ComposerPrimitive.Cancel aria-label="Stop response" title="Stop response" className="composer-send-button">
                    <IconStop size={16} />
                  </ComposerPrimitive.Cancel>
                ) : (
                  <ComposerPrimitive.Send
                    aria-label="Send message"
                    title={`Send message (${NEW_LINE_HINT})`}
                    disabled={unavailable}
                    className="composer-send-button"
                  >
                    <IconSend size={16} />
                  </ComposerPrimitive.Send>
                )}
              </div>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
