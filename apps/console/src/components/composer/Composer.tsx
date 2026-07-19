'use client';

// SOURCING: direct adopt-and-edit port of the 21st.dev
// muhammad-binsalman/glowing-ai-chat-assistant component supplied by Travis.
// Its material container, input well, grouped control deck, counter, footer,
// status, and overlay remain the component skeleton. @assistant-ui/react is
// fitted into those slots so the port is the real Console input. The floating
// launcher, close behavior, and right docking are removed for the permanent
// lower-third placement required by HANDOFF-CONSOLE-IA.

import { useEffect, useMemo, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  unstable_useMentionAdapter,
} from '@assistant-ui/react';
import { PresenceMark } from '@/components/mark/PresenceMark';
import {
  IconAttach,
  IconChevronDown,
  IconCommand,
  IconInfo,
  IconSend,
  IconStop,
} from '@/components/shell/icons';
import { useShellStore } from '@/lib/shell-store';
import { useThreadStore, type ComposerMode } from '@/lib/thread-store';
import { ComposerSheenCanvas } from './ComposerSheenCanvas';

const MAX_CHARACTERS = 2000;

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

function useObjectMentionAdapter(objects: readonly ObjectRef[]) {
  'use no memo';

  const items = useMemo(() => objects.map((object) => ({
    id: object.id,
    type: object.type,
    label: String(object.properties.title ?? object.properties.name ?? object.id),
    description: object.type,
    metadata: { objectId: object.id, objectType: object.type },
  })), [objects]);

  return unstable_useMentionAdapter({ items, includeModelContextTools: false });
}

export function Composer({
  host,
  compact = false,
  unavailable = false,
  webSearchAvailable = false,
}: ComposerProps) {
  const isRunning = useThreadStore((state) => state.isRunning);
  const staged = useThreadStore((state) => state.staged);
  const unstage = useThreadStore((state) => state.unstage);
  const mode = useThreadStore((state) => state.mode);
  const setMode = useThreadStore((state) => state.setMode);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const [mentions, setMentions] = useState<readonly ObjectRef[]>([]);
  const [characterCount, setCharacterCount] = useState(0);

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

  const mention = useObjectMentionAdapter(mentions);

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
          className="composer-shell composer-source-surface relative overflow-hidden border border-ij-seam-raised"
          onSubmit={() => setCharacterCount(0)}
        >
          <ComposerSheenCanvas streaming={isRunning} />
          <div aria-hidden="true" className="composer-source-overlay" />
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
            <ComposerPrimitive.Attachments components={{ Attachment: AttachmentChip }} />
            <div className="composer-source-input-section">
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
              />
              <div aria-hidden="true" className="composer-source-input-gradient" />
            </div>
            <div className="composer-source-controls-wrap border-t border-ij-seam">
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
                    value={mode}
                    onChange={(event) => setMode(event.target.value as ComposerMode)}
                    className="composer-mode-select"
                  >
                    <option value="auto">Auto</option>
                    <option value="theorem">Theorem</option>
                    <option value="web" disabled={!webSearchAvailable}>
                      Web search
                    </option>
                  </select>
                  <IconChevronDown size={13} className="composer-mode-chevron" />
                </label>
                <span className="composer-source-character-count" data-composer-character-count aria-live="polite">
                  <span>{characterCount}</span>/<span>{MAX_CHARACTERS}</span>
                </span>
                {compact ? (
                  <span className="composer-presence" data-presence-mark-placement="composer">
                    <PresenceMark state={isRunning ? 'composing' : 'idle'} size={22} staticOnly />
                  </span>
                ) : null}
                {isRunning ? (
                  <ComposerPrimitive.Cancel aria-label="Stop response" title="Stop response" className="composer-send-button">
                    <IconStop size={16} />
                  </ComposerPrimitive.Cancel>
                ) : (
                  <ComposerPrimitive.Send
                    aria-label="Send message"
                    title="Send message"
                    disabled={unavailable}
                    className="composer-send-button composer-source-send"
                  >
                    <IconSend size={16} />
                    <span aria-hidden="true" className="composer-source-send-glow" />
                  </ComposerPrimitive.Send>
                )}
              </div>
              <div className="composer-source-footer" data-composer-source-footer>
                <div className="composer-source-shortcut">
                  <IconInfo size={13} />
                  <span>Press <kbd>Shift + Enter</kbd> for a new line</span>
                </div>
                <div className="composer-source-status">
                  <span className="composer-presence" data-presence-mark-placement="composer">
                    <PresenceMark state={isRunning ? 'composing' : 'idle'} size={18} staticOnly />
                  </span>
                  <span data-web-search-state={webSearchAvailable ? 'available' : 'unavailable'}>
                    {isRunning
                      ? 'Working'
                      : mode === 'web'
                        ? 'Web search ready'
                        : mode === 'theorem'
                          ? 'Theorem ready'
                          : 'Auto ready'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ComposerPrimitive.Root>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
