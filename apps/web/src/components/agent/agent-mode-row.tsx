// SOURCING: none. Pure register-utility markup over live assistant-transport
// state; no upstream component models the console affordance row.

'use client';

import { useAuiState } from '@assistant-ui/react';

import type { TheoremAgentState } from '@/server/acp/state';

import { useTheoremAgentState } from './use-theorem-agent-state';

export type AgentMode = TheoremAgentState['mode'];

/* The chat affordance row (HP5): real structure above the empty composer.
 *
 * Every control is live (No Fake UI): the two mode buttons select the agent
 * process the bridge spawns for this thread. The bridge keys processes on
 * (mode, bindingId) and passes the mode to the ACP child as
 * THEOREM_MODEL_BACKEND_KIND, so this is the real backend fork, not a label.
 * The mode is fixed once a thread has begun (a different mode is a different
 * agent process); after that the row reads as quiet session facts.
 *
 * There is deliberately no recent-threads region: the bridge keeps sessions in
 * process memory only (src/server/acp/session-manager.ts) and no history
 * endpoint exists, so rendering nothing there is the honest empty state.
 */

const MODES: ReadonlyArray<{ id: AgentMode; label: string; hint: string }> = [
  { id: 'composed', label: 'Composed', hint: 'Heads routed through the agent binding' },
  { id: 'single', label: 'Single', hint: 'One head, no binding' },
];

export function AgentModeRow({
  mode,
  bindingId,
  onModeChange,
}: {
  mode: AgentMode;
  bindingId: string;
  onModeChange: (mode: AgentMode) => void;
}) {
  /* undefined = transport not bound yet (SSR or the first render after a
     mode-switch remount); treat it as a fresh, empty thread. The client-side
     thread state is checked too: an optimistic first message lands there
     before the server's first state snapshot, and a mode switch in that window
     would remount the runtime and discard the in-flight turn. */
  const transportStarted = useTheoremAgentState((state) => state.messages.length > 0) ?? false;
  const clientStarted = useAuiState((s) => !s.thread.isEmpty || s.thread.isRunning);
  const started = transportStarted || clientStarted;
  const sessionId = useTheoremAgentState((state) => state.sessionId) ?? null;
  const blockedReason = useTheoremAgentState((state) => state.blockedReason) ?? null;

  return (
    <div className="flex w-full flex-wrap items-center gap-cr-2 border-b border-cr-hairline px-cr-2 py-cr-1">
      <span className="font-cr-mono text-cr-caption uppercase tracking-widest text-cr-ink-3">
        mode
      </span>
      <div role="group" aria-label="Agent mode" className="flex gap-cr-1">
        {MODES.map((entry) => {
          const active = entry.id === mode;
          const locked = started && !active;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              disabled={locked}
              title={locked ? 'Mode is fixed once a thread starts' : entry.hint}
              onClick={() => {
                if (!active) onModeChange(entry.id);
              }}
              className="rounded-cr border border-transparent px-cr-2 py-cr-1 font-cr-ui text-cr-small text-cr-ink-2 transition-colors duration-chrome ease-cr hover:bg-cr-top disabled:cursor-not-allowed disabled:opacity-50 aria-[pressed=true]:border-cr-hairline aria-[pressed=true]:bg-cr-top aria-[pressed=true]:text-cr-ink focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-[-2px]"
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      {mode === 'composed' && (
        <span className="font-cr-mono text-cr-caption text-cr-ink-3">{bindingId}</span>
      )}
      {sessionId && (
        <span className="ml-auto font-cr-mono text-cr-caption text-cr-ink-3">
          session {sessionId.slice(0, 8)}
        </span>
      )}
      {blockedReason && (
        <span className="text-cr-caption text-cr-signal">{blockedReason}</span>
      )}
    </div>
  );
}
