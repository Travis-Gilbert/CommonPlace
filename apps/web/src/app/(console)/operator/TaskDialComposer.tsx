'use client';

/* The Task Dial composer — Chat ui 3's shell (Base UI Combobox + PreviewCard +
   textarea + send) re-purposed: the dial addresses the room, not a model.
   Default pill reads "Theorem" (the room itself, answered from substrate).
   The popup lists quick actions that insert a prewritten prompt for editing —
   never immediate send. /claude and /codex prefix the message as a mention
   delivered via coordinate; typing / in the textarea surfaces the same list.
   Hovering a head shows its live stat block (PreviewCard), fed real numbers.
   Porcelain skin; lucide icons (phosphor is not a dependency here). */

import { Combobox } from '@base-ui/react/combobox';
import { PreviewCard } from '@base-ui/react/preview-card';
import { ChevronDown, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Bay, HeadId, RunDrawer } from '@/lib/theorem-operator';
import { formatAge } from './parts';
import styles from './operator.module.css';

type DialTarget = { kind: 'room'; label: 'Theorem' } | { kind: 'head'; head: HeadId; label: string };

type DialItem =
  | { kind: 'target'; target: DialTarget }
  | { kind: 'action'; id: string; label: string; prompt: string };

const QUICK_ACTIONS: { id: string; label: string; prompt: string }[] = [
  { id: 'status', label: 'Status', prompt: 'Status: where does this task stand against its Build Table right now?' },
  { id: 'unblock', label: 'Unblock', prompt: 'Unblock: name the single blocker and the smallest step that clears it.' },
  { id: 'review-diff', label: 'Review my diff', prompt: 'Review my diff: check the changed files against the acceptance marks and try to break them.' },
  { id: 'reverify', label: 'Re-verify', prompt: 'Re-verify: run the Verify First items again and cite fresh evidence per item.' },
  { id: 'handoff', label: 'Handoff to other head', prompt: 'Handoff: package current state (footprint, open items, gotchas) for the other head to claim.' },
  { id: 'encode', label: 'Encode this', prompt: 'Encode this: write the durable lesson from this task into the substrate as a memory record.' },
];

export interface HeadStats {
  bay: Bay;
  eventCount: number;
  outcomeCount: number;
  messageCount: number;
}

function statsFor(bays: Bay[], drawer: RunDrawer | null): Map<string, HeadStats> {
  const map = new Map<string, HeadStats>();
  for (const bay of bays) {
    const events = drawer?.events.filter((e) => e.actor === bay.head) ?? [];
    map.set(bay.head, {
      bay,
      eventCount: events.length,
      outcomeCount: events.filter((e) => e.kind === 'outcome' || e.kind === 'release').length,
      messageCount: drawer?.messages?.filter((m) => m.from === bay.head).length ?? 0,
    });
  }
  return map;
}

/** Ten quiet segments; navy = information. No traffic-light scale. */
function MetricBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const filled = Math.max(0, Math.min(10, Math.round(value)));
  return (
    <div className={styles.dialMetric}>
      <span className={styles.dialMetricLabel} title={hint}>
        {label}
      </span>
      <div className={styles.dialMetricTrack} role="img" aria-label={`${label}: ${filled} of 10`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={styles.dialMetricSeg} data-filled={i < filled || undefined} />
        ))}
      </div>
    </div>
  );
}

function HeadPreview({ stats }: { stats: HeadStats }) {
  const { bay } = stats;
  const task = bay.task;
  const progress = task?.checklist && task.checklist.total > 0 ? (task.checklist.done / task.checklist.total) * 10 : 0;
  const elapsed = task?.claim ? formatAge(Date.now() - new Date(task.claim.claimedAt).getTime()) : null;
  return (
    <div className={styles.dialPreview}>
      <div className={styles.dialPreviewName}>{bay.label}</div>
      {task ? (
        <>
          <div className={styles.dialPreviewTask}>{task.goal}</div>
          <div className={`${styles.mono} ${styles.dim}`}>
            {elapsed ? `claimed ${elapsed} ago` : 'claimed'} · {bay.streaming ? 'streaming' : 'idle'}
          </div>
          <div className={styles.dialMetrics}>
            <MetricBar
              label="Build Table"
              value={progress}
              hint={task.checklist ? `${task.checklist.done}/${task.checklist.total} items` : undefined}
            />
            <MetricBar label="Events" value={stats.eventCount} hint={`${stats.eventCount} room events`} />
            <MetricBar label="Outcomes" value={stats.outcomeCount * 2} hint={`${stats.outcomeCount} outcomes`} />
          </div>
        </>
      ) : (
        <div className={`${styles.mono} ${styles.dim}`}>empty bay</div>
      )}
    </div>
  );
}

export function TaskDialComposer({
  bays,
  drawer,
  busy,
  onSend,
}: {
  bays: Bay[];
  drawer: RunDrawer | null;
  busy: boolean;
  onSend: (text: string, mention?: HeadId) => void;
}) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<DialTarget>({ kind: 'room', label: 'Theorem' });
  const previewHandle = useMemo(() => PreviewCard.createHandle<HeadStats>(), []);
  const stats = useMemo(() => statsFor(bays, drawer), [bays, drawer]);

  const items: DialItem[] = useMemo(
    () => [
      { kind: 'target', target: { kind: 'room', label: 'Theorem' } },
      ...bays.map((b): DialItem => ({ kind: 'target', target: { kind: 'head', head: b.head, label: b.label } })),
      ...QUICK_ACTIONS.map((a): DialItem => ({ kind: 'action', ...a })),
    ],
    [bays],
  );

  // Typing "/" surfaces the same routes inline.
  const slash = text.startsWith('/') ? text.slice(1).toLowerCase() : null;
  const slashMatches = useMemo(() => {
    if (slash === null) return [];
    return items.filter((i) =>
      (i.kind === 'target' ? i.target.label : i.label).toLowerCase().replace(/\s+/g, '-').startsWith(slash),
    );
  }, [slash, items]);

  function applyItem(item: DialItem) {
    if (item.kind === 'target') {
      setTarget(item.target);
      if (slash !== null) setText('');
    } else {
      setText(item.prompt);
    }
  }

  function submit() {
    const body = text.trim();
    if (!body || busy) return;
    onSend(body, target.kind === 'head' ? target.head : undefined);
    setText('');
  }

  return (
    <div className={styles.dial}>
      {slashMatches.length > 0 && (
        <div className={styles.dialSlash} role="listbox" aria-label="Slash routes">
          {slashMatches.map((item) => (
            <button
              key={item.kind === 'target' ? `t:${item.target.label}` : `a:${item.id}`}
              className={styles.dialSlashItem}
              onClick={() => applyItem(item)}
            >
              <span className={styles.mono}>
                /{(item.kind === 'target' ? item.target.label : item.label).toLowerCase().replace(/\s+/g, '-')}
              </span>
              {item.kind === 'action' && <span className={styles.dim}>{item.label}</span>}
            </button>
          ))}
        </div>
      )}

      <textarea
        className={styles.dialText}
        placeholder={target.kind === 'room' ? 'Ask the room — status, receipts, recall…' : `Message ${target.label}…`}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />

      <div className={styles.dialRow}>
        <Combobox.Root<DialItem>
          items={items}
          isItemEqualToValue={(a, b) =>
            a.kind === b.kind &&
            (a.kind === 'target'
              ? a.target.label === (b as { target: DialTarget }).target.label
              : a.id === (b as { id: string }).id)
          }
          onValueChange={(item) => {
            if (item) applyItem(item);
          }}
        >
          <Combobox.Trigger className={styles.dialTrigger} aria-label="Task dial">
            <span className={styles.dialMark} aria-hidden="true" />
            {target.label}
            <ChevronDown className={styles.glyph} />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner align="start" sideOffset={4} className={styles.dialPos}>
              <Combobox.Popup className={`porcelain ${styles.dialPopup}`} aria-label="Task dial">
                <PreviewCard.Root<HeadStats> handle={previewHandle}>
                  {({ payload }) => (
                    <>
                      <div className={styles.dialSection}>Address</div>
                      <Combobox.List className={styles.dialList}>
                        {(item: DialItem) =>
                          item.kind === 'target' ? (
                            <Combobox.Item key={`t:${item.target.label}`} className={styles.dialItem} value={item}>
                              {item.target.kind === 'head' ? (
                                <PreviewCard.Trigger
                                  className={styles.dialItemFace}
                                  handle={previewHandle}
                                  payload={stats.get(item.target.head)!}
                                  delay={80}
                                  closeDelay={180}
                                  render={<div />}
                                >
                                  <span className={styles.mono}>/{item.target.label.toLowerCase().replace(/\s+/g, '-')}</span>
                                  {item.target.label}
                                </PreviewCard.Trigger>
                              ) : (
                                <span className={styles.dialItemFace}>
                                  <span className={styles.dialMark} aria-hidden="true" />
                                  Theorem — the room itself
                                </span>
                              )}
                            </Combobox.Item>
                          ) : (
                            <Combobox.Item key={`a:${item.id}`} className={styles.dialItem} value={item}>
                              <span className={styles.dialItemFace}>
                                {item.label}
                                <span className={`${styles.dim} ${styles.dialItemHint}`}>inserts a prompt</span>
                              </span>
                            </Combobox.Item>
                          )
                        }
                      </Combobox.List>
                      <PreviewCard.Portal keepMounted>
                        <PreviewCard.Positioner align="center" side="right" sideOffset={8} className={styles.dialPreviewPos}>
                          <PreviewCard.Popup className={`porcelain ${styles.dialPreviewPopup}`}>
                            {payload ? <HeadPreview stats={payload} /> : null}
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </>
                  )}
                </PreviewCard.Root>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>

        <button className={styles.btnNavy} onClick={submit} disabled={busy || !text.trim()} type="button">
          <Send className={styles.glyph} />
          Send
        </button>
      </div>
    </div>
  );
}
