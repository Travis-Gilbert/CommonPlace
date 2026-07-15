'use client';

import { AssistantRuntimeProvider, useAssistantTransportState } from '@assistant-ui/react';

import { useTheoremAgentRuntime } from '@/app/(console)/agent/runtime';
import type { TheoremAgentState } from '@/server/acp/state';
import { Thread } from '@/components/assistant-ui/thread';

import { HeadContribution } from './head-contribution';
import { PermissionPrompt } from './permission-prompt';

export function TheoremAgentThread({
  mode = 'composed',
  bindingId = 'agent:theorem',
}: {
  mode?: 'single' | 'composed';
  bindingId?: string;
}) {
  const runtime = useTheoremAgentRuntime({ mode, bindingId });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
      <ContributionLedger />
      <PermissionPrompt />
    </AssistantRuntimeProvider>
  );
}

function ContributionLedger() {
  const messages = useAssistantTransportState(
    (state) => (state as TheoremAgentState).messages.filter((message) => message.role === 'assistant'),
  );
  return (
    <div>
      {messages.map((message) => (
        <HeadContribution key={message.id} contributions={message.contributions} />
      ))}
    </div>
  );
}
