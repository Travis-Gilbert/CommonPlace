'use client';

import { useAssistantTransportSendCommand } from '@assistant-ui/react';

import { useTheoremAgentState } from './use-theorem-agent-state';

export function PermissionPrompt() {
  /* Defensive read: the stock transport-state hook throws while the runtime is
     unbound (SSR, mode-switch remount). undefined reads as no pending ask. */
  const permission = useTheoremAgentState((state) => state.pendingPermission) ?? null;
  const sendCommand = useAssistantTransportSendCommand();
  if (!permission) return null;
  const respond = (decision: 'allow' | 'reject') => {
    sendCommand({ type: 'permission-response', callId: permission.callId, decision });
  };
  return (
    <aside aria-live="polite" className="mt-4 border-y border-cr-hairline py-3">
      <p className="m-0 font-mono text-xs uppercase tracking-wide text-cr-ink-2">Permission required</p>
      <p className="mt-1 text-sm text-cr-ink">Allow Theorem to run {permission.name}?</p>
      <pre className="mt-2 overflow-x-auto rounded bg-cr-ground p-2 text-xs text-cr-ink-2">
        {JSON.stringify(permission.rawInput, null, 2)}
      </pre>
      <div className="mt-3 flex gap-2">
        <button type="button" className="cr-control" onClick={() => respond('allow')}>
          Allow
        </button>
        <button type="button" className="cr-control" onClick={() => respond('reject')}>
          Reject
        </button>
      </div>
    </aside>
  );
}
