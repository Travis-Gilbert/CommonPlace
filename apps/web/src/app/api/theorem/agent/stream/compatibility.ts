// SOURCING: none — pure logic, no upstream component applies
import { runDirectProviderHead } from '@/app/api/theorem/agent/direct-provider';
import {
  normalizeTheoremAgentInput,
  type TheoremAgentNormalizedInput,
} from '@/lib/theorem-agent';
import {
  beginTurn,
  completeTurn,
  createTheoremAgentState,
  failTurn,
  type AgentProcessKey,
  type TheoremAgentState,
} from '@/server/acp/state';

export function isAcpSpawnUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  if (code === 'ENOENT') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('spawn theorem enoent') ||
    message.includes('enoent') ||
    message.includes('theorem cli was not included') ||
    message.includes('not found')
  );
}

export function firstUserPrompt(commands: unknown): string | null {
  if (!Array.isArray(commands)) return null;
  for (const command of commands) {
    if (!command || typeof command !== 'object') continue;
    const record = command as {
      type?: unknown;
      message?: { role?: unknown; parts?: unknown };
    };
    if (record.type !== 'add-message' || record.message?.role !== 'user') continue;
    if (!Array.isArray(record.message.parts)) continue;
    const text = record.message.parts
      .filter(
        (part): part is { type: 'text'; text: string } =>
          !!part &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }
  return null;
}

export function resolveCompatibilityInput(
  body: Record<string, unknown>,
  prompt: string,
): TheoremAgentNormalizedInput {
  const bindingId =
    (typeof body.bindingId === 'string' && body.bindingId.trim()) ||
    (typeof (body.state as { bindingId?: unknown } | undefined)?.bindingId === 'string'
      ? String((body.state as { bindingId: string }).bindingId)
      : 'agent:theorem');
  return normalizeTheoremAgentInput({
    task: prompt,
    mode: 'ask',
    bindingId,
  });
}

export async function runCompatibilityAgent(
  input: TheoremAgentNormalizedInput,
): Promise<{ answer: string; headId: string }> {
  const direct = await runDirectProviderHead(input);
  if (direct.result?.answer) {
    return {
      answer: direct.result.answer,
      headId: direct.result.heads[0] ?? 'direct',
    };
  }
  const detail = direct.attempts.join('; ') || 'no direct provider head answered';
  throw new Error(`Compatibility agent unavailable: ${detail}`);
}

export function buildCompatibilityStates(
  key: Pick<AgentProcessKey, 'mode' | 'bindingId'>,
  prompt: string,
  outcome: { ok: true; answer: string; headId: string } | { ok: false; message: string },
): TheoremAgentState[] {
  const sessionId = `compat:${Date.now().toString(36)}`;
  const running = beginTurn(createTheoremAgentState(key, sessionId), prompt);
  if (!outcome.ok) {
    const failed = failTurn(withAssistantText(running, outcome.message));
    return [running, failed];
  }
  const answered = withAssistantText(
    running,
    outcome.answer,
    outcome.headId ? [{ headId: outcome.headId, summary: 'direct provider reply', at: Date.now() }] : [],
  );
  return [running, completeTurn(answered, 'end_turn')];
}

function withAssistantText(
  state: TheoremAgentState,
  text: string,
  contributions: TheoremAgentState['messages'][number]['contributions'] = [],
): TheoremAgentState {
  const messages = [...state.messages];
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return state;
  messages[messages.length - 1] = {
    ...last,
    text,
    contributions: contributions.length ? contributions : last.contributions,
  };
  return { ...state, messages };
}
