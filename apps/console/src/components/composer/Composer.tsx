'use client';

// SOURCING: @assistant-ui/react composer, attachment, and trigger primitives
// plus the 21st.dev reuno-ui AI input mechanics extraction. This is the only
// generative input. It owns attachments, object mentions, mode, /do, send,
// and the Presence mark.

import { useEffect, useMemo, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  unstable_useMentionAdapter,
} from '@assistant-ui/react';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import { ComposerSheenCanvas } from './ComposerSheenCanvas';

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

export function Composer({ host, compact = false, unavailable = false }: ComposerProps) {
  const isRunning = useThreadStore((state) => state.isRunning);
  const staged = useThreadStore((state) => state.staged);
  const unstage = useThreadStore((state) => state.unstage);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const [mentions, setMentions] = useState<readonly ObjectRef[]>([]);
  const [mode, setMode] = useState('Agent');

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
          className="relative overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised"
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
            <ComposerPrimitive.Attachments components={{ Attachment: AttachmentChip }} />
            <ComposerPrimitive.Input
              rows={1}
              disabled={unavailable}
              data-composer-input
              data-thread-composer-input
              placeholder={unavailable ? 'Chat endpoint unavailable' : 'Message the harness. Use @ for objects or /do for an action.'}
              className={`composer-input w-full resize-none bg-transparent px-3 py-2 text-ij-ink outline-none placeholder:text-ij-ink-disabled ${compact ? 'min-h-ij-control' : ''}`}
            />
            <div className="flex items-center gap-1 border-t border-ij-seam px-2 py-1">
              <ComposerPrimitive.AddAttachment
                aria-label="Attach file"
                disabled={unavailable}
                className="h-ij-control rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
              >
                Attach
              </ComposerPrimitive.AddAttachment>
              <button
                type="button"
                aria-label="Open action sheet"
                onClick={() => openActionSheet({ instruction: '', chips: [] })}
                className="h-ij-control rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
                style={{ transition: 'var(--rec-clickable-transition)' }}
              >
                /do
              </button>
              <select
                aria-label="Composer mode"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
              >
                <option>Agent</option>
                <option>Plan</option>
                <option>Model</option>
              </select>
              <span className="ml-auto flex items-center" data-presence-mark-placement="composer">
                <PresenceMark state={isRunning ? 'composing' : 'idle'} size={compact ? 18 : 22} />
              </span>
              {isRunning ? (
                <ComposerPrimitive.Cancel className="h-ij-control rounded-ij-arc bg-ij-raised px-3 text-ij-ink hover:bg-ij-hover-surface">
                  Stop
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send
                  disabled={unavailable}
                  className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover disabled:bg-ij-disabled disabled:text-ij-ink-disabled"
                >
                  Send
                </ComposerPrimitive.Send>
              )}
            </div>
          </div>
        </ComposerPrimitive.Root>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
