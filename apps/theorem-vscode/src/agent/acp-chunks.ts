// SOURCING: @commonplace/theorem-acp/state. Pure filter for Studio chat deltas.
import { agentMessageTextFromUpdate, type AcpSessionUpdate } from '@commonplace/theorem-acp/state';

/**
 * Forward agent_message_chunk text for the active session into a ChatTransport
 * onDelta callback. Ignores other update kinds and other sessions.
 */
export function forwardAgentMessageChunk(
  sessionId: string,
  notification: { readonly sessionId: string; readonly update: AcpSessionUpdate },
  onDelta: (chunk: string) => void,
): void {
  if (notification.sessionId !== sessionId) return;
  if (notification.update.sessionUpdate !== 'agent_message_chunk') return;
  const chunk = agentMessageTextFromUpdate(notification.update);
  if (chunk) onDelta(chunk);
}
