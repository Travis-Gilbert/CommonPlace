'use client';

import { useState } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';

import { useTheoremAgentRuntime } from '@/app/(console)/agent/runtime';
import { Thread } from '@/components/assistant-ui/thread';

import { AgentModeRow, type AgentMode } from './agent-mode-row';
import { HeadContribution } from './head-contribution';
import { PermissionPrompt } from './permission-prompt';
import { useTheoremAgentState } from './use-theorem-agent-state';

export function TheoremAgentThread({
  mode: initialMode = 'composed',
  bindingId = 'agent:theorem',
}: {
  mode?: AgentMode;
  bindingId?: string;
}) {
  const [mode, setMode] = useState<AgentMode>(initialMode);
  /* Remount on mode change: the bridge keys the ACP process on
     (mode, bindingId), so a new mode is a new agent process and a fresh
     runtime, never a silent retarget of a live thread. The affordance row only
     offers the switch while the thread is empty, so nothing is discarded. */
  return <ThreadInstance key={mode} mode={mode} bindingId={bindingId} onModeChange={setMode} />;
}

function ThreadInstance({
  mode,
  bindingId,
  onModeChange,
}: {
  mode: AgentMode;
  bindingId: string;
  onModeChange: (mode: AgentMode) => void;
}) {
  const runtime = useTheoremAgentRuntime({ mode, bindingId });
  /* Every consumer below reads agent state through useTheoremAgentState, which
     tolerates the windows where the transport extras are not attached yet
     (SSR, and the first render after a mode-switch remount). The stock
     useAssistantTransportState throws there and took the whole page down. */
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentModeRow mode={mode} bindingId={bindingId} onModeChange={onModeChange} />
      <Thread />
      <ContributionLedger />
      <PermissionPrompt />
    </AssistantRuntimeProvider>
  );
}

function ContributionLedger() {
  /* Select the stable messages reference and filter during render: a selector
     that filters returns a fresh array every getSnapshot read, which React
     rejects as an uncached snapshot (infinite re-render loop). */
  const messages = useTheoremAgentState((state) => state.messages) ?? [];
  return (
    <div>
      {messages
        .filter((message) => message.role === 'assistant')
        .map((message) => (
          <HeadContribution key={message.id} contributions={message.contributions} />
        ))}
    </div>
  );
}
