'use client';

// SOURCING: @assistant-ui/react thread and message primitives,
// @assistant-ui/react-markdown, the shared Composer, and the 21st.dev
// isaiahBjork agent-plan structure extraction. The Presence mark appears only
// inside Composer. Streaming text never participates in layout animation.

import { createContext, useContext, useEffect, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { MessagePrimitive, ThreadPrimitive, useMessage } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { motion } from 'motion/react';
import { Composer, NEW_LINE_HINT } from '@/components/composer/Composer';
import { useShellStore, type ConnectionState } from '@/lib/shell-store';
import { useThreadStore, chatEndpoint, type AgentPlanStep } from '@/lib/thread-store';
import { submitThreadText } from '@/lib/thread-submit';
import { EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';

export const ThreadRuntimeAvailable = createContext(false);

function MessageShell({ children }: { children: React.ReactNode }) {
  const durations = useMotionDurations();
  return (
    <motion.div
      initial={durations.reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: seconds(durations.base), ease: EASE_OUT }}
      className="px-3 py-2"
    >
      {children}
    </motion.div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <MessageShell>
        <div data-speaker="human" className="ml-8 rounded-ij-arc bg-ij-raised px-3 py-2 font-cp-human text-cp-human">
          <MessagePrimitive.Parts />
        </div>
      </MessageShell>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive />;
}

function AssistantMessage() {
  const degradation = useMessage((message) => message.metadata.custom?.degradation) as
    | { degraded: true; missingIndexes: string[] }
    | undefined;
  return (
    <MessagePrimitive.Root>
      <MessageShell>
        <div data-speaker="agent" className="mr-8 px-1 font-cp-agent text-cp-agent">
          {degradation?.degraded ? (
            <span className="mb-1 inline-flex rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn" data-ask-degraded>
              degraded: {degradation.missingIndexes.join(', ')}
            </span>
          ) : null}
          <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
        </div>
      </MessageShell>
    </MessagePrimitive.Root>
  );
}

function AgentPlan({ steps }: { steps: readonly AgentPlanStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section data-agent-plan aria-label="Agent plan" className="mx-3 my-2 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised">
      <div className="flex h-ij-control items-center border-b border-ij-seam px-3 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        Plan
      </div>
      {steps.map((step) => (
        <div key={step.id} data-plan-status={step.status} className="flex h-ij-row items-center gap-2 border-b border-ij-seam px-3 last:border-b-0">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{
              background: step.status === 'complete'
                ? 'var(--ij-success)'
                : step.status === 'refused'
                  ? 'var(--ij-error)'
                  : 'var(--ij-ink-disabled)',
            }}
          />
          <span className="min-w-0 flex-1 truncate text-ij-ink">{step.label}</span>
          {step.tool ? <span className="font-ij-mono text-ij-ink-info">{step.tool}</span> : null}
          <span className="text-ij-ink-disabled">{step.status}</span>
        </div>
      ))}
    </section>
  );
}

interface StarterSuggestion {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
}

function titleOf(object: ObjectRef | undefined, fallback: string): string {
  return String(object?.properties.title ?? object?.properties.name ?? fallback);
}

/** The starter SLOTS (HANDOFF-CONSOLE-DIMENSIONALITY X5). The empty state gets
 *  its structure without waiting for wires: the three slots always render, so
 *  the first-run Chat reads as a quiet room rather than missing paint. A slot
 *  is disabled until its live suggestion lands and says why in the meantime --
 *  the REAL refusal, never a placeholder mood -- and flips live when identity
 *  arrives, per HANDOFF-CONSOLE-IA I2. The resting labels name the shape of the
 *  offer, which is true before the tenant is known and stays true after. */
const STARTER_SLOTS = [
  { id: 'recent-record', resting: 'Review a recent record' },
  { id: 'recent-document', resting: 'Summarize a recent document' },
  { id: 'runnable-action', resting: 'Plan an action' },
] as const;

/** The identity refusal, named exactly as the seam reports it. The console's
 *  identity-refusal state maps HTTP 403, which the harness principal resolver
 *  emits as principal_resolution=unauthenticated; that string is what a person
 *  can act on, so it is what the slot shows. */
function refusalFor(connection: ConnectionState, endpointMissing: boolean): string | null {
  if (endpointMissing) return 'Chat endpoint unavailable: configure NEXT_PUBLIC_CONSOLE_CHAT_URL';
  if (connection === 'identity-refused') return 'principal_resolution=unauthenticated';
  if (connection === 'disconnected') return 'Disconnected from the object seam';
  if (connection === 'connecting') return 'Connecting to the object seam';
  return null;
}

function StarterSuggestions({ host, disabled }: { host: BlockHost; disabled: boolean }) {
  const [suggestions, setSuggestions] = useState<readonly StarterSuggestion[]>([]);
  const connection = useShellStore((state) => state.connection);

  useEffect(() => {
    let active = true;
    void Promise.all([
      Promise.resolve(host.query({ types: ['record'], rank: [{ kind: 'field', field: 'updated', direction: 'desc' }], page: { limit: 1 } })),
      Promise.resolve(host.query({ types: ['doc'], rank: [{ kind: 'field', field: 'updated', direction: 'desc' }], page: { limit: 1 } })),
    ]).then(([records, docs]) => {
      if (!active) return;
      const record = records.objects[0];
      const doc = docs.objects[0];
      const recordTitle = titleOf(record, 'recent record');
      const docTitle = titleOf(doc, 'recent document');
      setSuggestions([
        { id: 'recent-record', label: `Review ${recordTitle}`, prompt: `Review the recent record: ${recordTitle}` },
        { id: 'recent-document', label: `Summarize ${docTitle}`, prompt: `Summarize the recent document: ${docTitle}` },
        { id: 'runnable-action', label: `Plan action for ${recordTitle}`, prompt: `/do Plan the next action for ${recordTitle}` },
      ]);
    }).catch(() => {
      if (active) setSuggestions([]);
    });
    return () => {
      active = false;
    };
  }, [host]);

  const refusal = refusalFor(connection, disabled);

  return (
    <div className="flex h-full flex-col justify-end gap-3 px-3 pb-4 text-ij-ink-info" data-chat-empty-state>
      <p data-chat-empty-lede className="text-ij-ink">Start from live tenant context.</p>
      <div className="flex flex-wrap gap-2" data-chat-starters>
        {STARTER_SLOTS.map((slot) => {
          const live = suggestions.find((suggestion) => suggestion.id === slot.id);
          // A slot with no live suggestion is refused for a named reason: the
          // seam's own refusal when there is one, otherwise the plain fact that
          // tenant context has not arrived.
          const reason = live ? null : (refusal ?? 'Tenant suggestions are unavailable');
          return (
            <button
              key={slot.id}
              type="button"
              data-chat-starter={slot.id}
              data-starter-refusal={reason ?? undefined}
              title={reason ?? undefined}
              disabled={reason !== null}
              onClick={() => (live ? void submitThreadText(live.prompt) : undefined)}
              className="rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 py-2 text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-disabled"
              style={{ transition: 'var(--rec-clickable-transition)' }}
            >
              {live ? live.label : slot.resting}
            </button>
          );
        })}
      </div>
      {refusal ? (
        <p data-starters-unavailable className="font-ij-mono text-ij-ink-disabled">{refusal}</p>
      ) : null}
      {/* The new-line hint's second home (X1): the send control's title carries
          it for people already typing, the first run carries it for people who
          have not started. */}
      <p data-composer-hint className="text-ij-ink-disabled">{NEW_LINE_HINT}</p>
    </div>
  );
}

export function ThreadView({ host, density = 'compact' }: { host: BlockHost; density?: 'full' | 'compact' }) {
  const runtimeAvailable = useContext(ThreadRuntimeAvailable);
  const error = useThreadStore((state) => state.error);
  const plan = useThreadStore((state) => state.plan);
  const endpoint = chatEndpoint();
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { web_search?: unknown };
        return body.web_search === true;
      })
      .then((available) => {
        if (active) setWebSearchAvailable(available);
      })
      .catch(() => {
        if (active) setWebSearchAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!runtimeAvailable) {
    return (
      <div className="m-3 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-4 text-ij-ink-info">
        Thread unavailable outside an assistant runtime.
      </div>
    );
  }

  const full = density === 'full';
  return (
    <ThreadPrimitive.Root
      data-chat-surface={full ? 'full' : undefined}
      className={`flex h-full min-h-0 flex-col ${full ? 'bg-ij-editor' : 'bg-ij-chrome'}`}
    >
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto flex h-full w-full flex-col ${full ? 'max-w-4xl pt-8' : ''}`}>
          <ThreadPrimitive.Empty>
            <StarterSuggestions host={host} disabled={!endpoint} />
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          <AgentPlan steps={plan} />
          {error ? <div className="px-4 py-1 text-ij-error">{error}</div> : null}
        </div>
      </ThreadPrimitive.Viewport>
      <div className={full ? 'mx-auto mb-24 w-full max-w-4xl px-6' : 'p-2'} data-composer-zone>
        {!endpoint ? (
          <p data-chat-unavailable className="mb-1 text-ij-ink-info">
            Chat endpoint unavailable: configure NEXT_PUBLIC_CONSOLE_CHAT_URL.
          </p>
        ) : null}
        <Composer
          host={host}
          compact={!full}
          unavailable={!endpoint}
          webSearchAvailable={webSearchAvailable}
        />
      </div>
    </ThreadPrimitive.Root>
  );
}
