// SOURCING: none. Map harness stream events onto ProcessLiveness (PG7).

import type {
  ProcessLiveness,
  ProgramRunEvent,
} from '@commonplace/program-contracts';

export function applyRunEvent(
  current: Readonly<Record<string, ProcessLiveness>>,
  event: ProgramRunEvent,
): Record<string, ProcessLiveness> {
  const nodeId = event.node_id;
  const next = { ...current };
  if (event.liveness) {
    next[nodeId] = event.liveness;
    return next;
  }

  switch (event.kind) {
    case 'node_started':
    case 'node_output_chunk':
    case 'node_token_chunk':
      next[nodeId] = 'running';
      break;
    case 'node_verifying':
      next[nodeId] = 'verifying';
      break;
    case 'node_finished':
    case 'execution_cached':
      next[nodeId] = 'dormant';
      break;
    case 'node_error':
      next[nodeId] = 'failed';
      break;
    case 'node_refused':
      next[nodeId] = 'refused';
      break;
    case 'node_parked':
      next[nodeId] = 'parked';
      break;
  }
  return next;
}
