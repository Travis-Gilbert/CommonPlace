// SOURCING: @commonplace/theorem-acp managed sessions plus Vercel AI SDK 5's
// UI-message SSE protocol. The endpoint is a bearer-authenticated adapter for
// TheoremWeb and does not introduce a parallel chat runtime.

import { timingSafeEqual } from 'node:crypto';
import {
  BridgeCommandError,
  dispatchBridgeCommands,
  resolveBridgeSession,
  validateBridgeCommands,
  type BridgeCommand,
} from '@commonplace/theorem-acp/bridge';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { readChatRequest } from '@/lib/chat-delta';
import {
  BoundedRequestBodyError,
  readBoundedRequestBody,
} from '@/lib/server/bounded-request-body';
import { loadInstanceCapabilities } from '@/lib/server/instance-capabilities';
import {
  createTheoremUiMessageStream,
  theoremUiMessageStreamHeaders,
} from '@/lib/server/theoremweb-ui-message-stream';
import { loadWebResearch } from '@/lib/server/web-research';
import {
  appendGraphDocuments,
  appendProvidedSources,
  appendWebResearch,
  type GraphAttachment,
  type WebResearchSource,
} from '@/lib/web-research-contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_REQUEST_SOURCES = 5;
const MAX_SOURCE_TITLE_LENGTH = 240;
const MAX_SOURCE_SNIPPET_LENGTH = 800;
const MAX_REQUEST_ATTACHMENTS = 5;
const MAX_ATTACHMENT_TITLE_LENGTH = 240;
const MAX_ATTACHMENT_MEDIA_TYPE_LENGTH = 80;
const MAX_ATTACHMENT_CONTENT_LENGTH = 32 * 1024;

export async function POST(request: Request): Promise<Response> {
  const principal = authenticate(request);
  if (principal instanceof Response) return principal;

  try {
    const body = await readBody(request);
    const commands = commandsFromBody(body);
    const sources = await groundResearch(commands, body, principal, request);
    const session = await resolveBridgeSession(sessionSelector(body, principal));
    const headers = theoremUiMessageStreamHeaders();
    headers.set('x-theorem-agent-session', session.sessionId);
    return new Response(
      createTheoremUiMessageStream({
        session,
        sources,
        signal: request.signal,
        tenant: principal.tenant,
        start: () => dispatchBridgeCommands(session, commands),
      }),
      { status: 200, headers },
    );
  } catch (error) {
    const status = error instanceof BridgeCommandError
      ? error.status
      : error instanceof BoundedRequestBodyError
        ? error.code === 'request_body_too_large' ? 413 : 400
        : 502;
    const message = error instanceof Error
      ? error.message
      : 'The Theorem UI-message stream could not be started.';
    return Response.json({ error: 'theorem_ui_message_stream_failed', message }, { status });
  }
}

function authenticate(request: Request): HarnessPrincipal | Response {
  const configuredToken = process.env.THEOREMWEB_AGENT_STREAM_TOKEN?.trim();
  const tenant = process.env.THEOREMWEB_AGENT_STREAM_TENANT?.trim();
  if (!configuredToken || !tenant) {
    return Response.json(
      { error: 'theorem_ui_message_stream_unconfigured' },
      { status: 503 },
    );
  }
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match || !tokensEqual(match[1], configuredToken)) {
    return Response.json(
      { error: 'theorem_ui_message_stream_unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }
  return {
    tenant,
    githubLogin: tenant,
    harnessIdentity: `service:theoremweb-agent-stream:${tenant}`,
  };
}

function tokensEqual(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const bytes = await readBoundedRequestBody(request, MAX_REQUEST_BYTES);
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BridgeCommandError('Expected a JSON object request body.', 400);
  }
}

function commandsFromBody(body: Record<string, unknown>): BridgeCommand[] {
  if (body.commands !== undefined) return validateBridgeCommands(body.commands);
  const chat = readChatRequest(body);
  return [{
    type: 'add-message',
    message: { role: 'user', parts: [{ type: 'text', text: chat.promptText }] },
    parentId: null,
    sourceId: null,
    displayText: chat.displayText,
  }];
}

function sessionSelector(
  body: Record<string, unknown>,
  principal: HarnessPrincipal,
): Record<string, unknown> {
  const acpToken = process.env.THEOREMWEB_ACP_TOKEN?.trim();
  const configuredMode = process.env.THEOREMWEB_ACP_MODE?.trim();
  const state = body.state && typeof body.state === 'object' && !Array.isArray(body.state)
    ? body.state as Record<string, unknown>
    : null;
  return {
    ...(configuredMode
      ? { mode: configuredMode }
      : body.mode === undefined ? {} : { mode: body.mode }),
    ...(body.bindingId === undefined ? {} : { bindingId: body.bindingId }),
    ...(typeof state?.sessionId === 'string'
      ? { state: { sessionId: state.sessionId } }
      : {}),
    tenant: principal.tenant,
    ...(acpToken ? { authToken: acpToken } : {}),
  };
}

async function groundResearch(
  commands: BridgeCommand[],
  body: Record<string, unknown>,
  principal: HarnessPrincipal,
  request: Request,
): Promise<readonly WebResearchSource[]> {
  const providedSources = readProvidedSources(body.sources);
  const attachments = readGraphAttachments(body.attachments);
  const capability = body.capability as { kind?: unknown } | undefined;
  const needsWebResearch = capability?.kind === 'web' || body.turnRoute === 'research';
  const command = commands.find(
    (candidate): candidate is Extract<BridgeCommand, { type: 'add-message' }> =>
      candidate.type === 'add-message',
  );
  if ((providedSources.length > 0 || needsWebResearch || attachments.length > 0) && !command) {
    throw new BridgeCommandError('A sourced or attached turn requires an add-message command.', 400);
  }
  if (!command) return [];

  const displayText = command.displayText
    ?? command.message.parts.map((part) => part.text).join('\n');
  let promptText = command.message.parts.map((part) => part.text).join('\n');
  if (providedSources.length > 0) {
    promptText = appendProvidedSources(promptText, providedSources);
  }
  if (attachments.length > 0) {
    promptText = appendGraphDocuments(promptText, attachments);
  }
  if (!needsWebResearch) {
    replaceCommandPrompt(commands, command, promptText);
    return providedSources;
  }

  const capabilities = await loadInstanceCapabilities(principal);
  if (!capabilities.ok) throw new BridgeCommandError(
    await responseMessage(capabilities.response),
    capabilities.response.status,
  );
  if (!capabilities.capabilities.webSearch) {
    throw new BridgeCommandError(
      'Web search is unavailable on this connected CommonPlace backend.',
      409,
    );
  }
  const research = await loadWebResearch(displayText, principal, request);
  if (!research.ok) {
    throw new BridgeCommandError(
      await responseMessage(research.response),
      research.response.status,
    );
  }
  promptText = appendWebResearch(
    promptText,
    research.sources,
  );
  replaceCommandPrompt(commands, command, promptText);
  return mergeSources(providedSources, research.sources);
}

function replaceCommandPrompt(
  commands: BridgeCommand[],
  command: Extract<BridgeCommand, { type: 'add-message' }>,
  promptText: string,
): void {
  const index = commands.indexOf(command);
  commands[index] = {
    ...command,
    message: { ...command.message, parts: [{ type: 'text', text: promptText }] },
  };
}

function readProvidedSources(value: unknown): WebResearchSource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REQUEST_SOURCES) {
    throw new BridgeCommandError(`Expected at most ${MAX_REQUEST_SOURCES} source references.`, 400);
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BridgeCommandError(`Source ${index + 1} must be an object.`, 400);
    }
    const source = raw as Record<string, unknown>;
    const title = boundedSourceText(source.title, MAX_SOURCE_TITLE_LENGTH);
    const snippet = boundedSourceText(source.snippet, MAX_SOURCE_SNIPPET_LENGTH);
    let url: URL;
    try {
      url = new URL(typeof source.url === 'string' ? source.url : '');
    } catch {
      throw new BridgeCommandError(`Source ${index + 1} has an invalid URL.`, 400);
    }
    if (!title || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new BridgeCommandError(
        `Source ${index + 1} requires a title and an HTTP(S) URL without credentials.`,
        400,
      );
    }
    return {
      title,
      url: url.toString(),
      snippet,
      provider: 'TheoremWeb request',
    };
  });
}

function boundedSourceText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate the client-resolved `attachments` field against the Rust host's
 * `ResolvedAttachment` wire shape (see `attachments.rs`). Every attachment
 * was already resolved by the client -- against the graph documents it can
 * see -- before this request; this function only bounds and re-types what
 * arrives, it never fetches a document itself.
 */
function readGraphAttachments(value: unknown): GraphAttachment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REQUEST_ATTACHMENTS) {
    throw new BridgeCommandError(`Expected at most ${MAX_REQUEST_ATTACHMENTS} attachments.`, 400);
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BridgeCommandError(`Attachment ${index + 1} must be an object.`, 400);
    }
    const attachment = raw as Record<string, unknown>;
    const mediaType = boundedSourceText(attachment.media_type, MAX_ATTACHMENT_MEDIA_TYPE_LENGTH);
    if (attachment.kind === 'document') {
      const documentId = boundedSourceText(attachment.document_id, MAX_ATTACHMENT_TITLE_LENGTH);
      const title = boundedSourceText(attachment.title, MAX_ATTACHMENT_TITLE_LENGTH);
      const content = boundedSourceText(attachment.content, MAX_ATTACHMENT_CONTENT_LENGTH);
      if (!documentId || !title || !mediaType || !content) {
        throw new BridgeCommandError(
          `Attachment ${index + 1} requires a document id, title, media type, and content.`,
          400,
        );
      }
      return { kind: 'document', documentId, title, mediaType, content } as const;
    }
    if (attachment.kind === 'image') {
      const name = boundedSourceText(attachment.name, MAX_ATTACHMENT_TITLE_LENGTH);
      let url: URL;
      try {
        url = new URL(typeof attachment.url === 'string' ? attachment.url : '');
      } catch {
        throw new BridgeCommandError(`Attachment ${index + 1} has an invalid URL.`, 400);
      }
      if (!name || !mediaType || !['http:', 'https:'].includes(url.protocol)
        || url.username || url.password) {
        throw new BridgeCommandError(
          `Attachment ${index + 1} requires a name, media type, and an HTTP(S) URL without credentials.`,
          400,
        );
      }
      return { kind: 'image', name, mediaType, url: url.toString() } as const;
    }
    throw new BridgeCommandError(`Attachment ${index + 1} has an unknown kind.`, 400);
  });
}

function mergeSources(
  first: readonly WebResearchSource[],
  second: readonly WebResearchSource[],
): WebResearchSource[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((source) => {
    if (seen.has(source.url) || seen.size === MAX_REQUEST_SOURCES) return false;
    seen.add(source.url);
    return true;
  });
}

async function responseMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof payload?.message === 'string'
    ? payload.message
    : `The connected backend refused the request with status ${response.status}.`;
}
