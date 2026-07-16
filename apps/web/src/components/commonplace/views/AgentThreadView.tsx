'use client';

/* Screen archetype: streaming transcript (SPEC-UX-PHYSICS D8, see
   docs/plans/ux-physics-accent/archetypes.md). A heterogeneous, streaming
   conversation: the last item mutates as tokens arrive and the view auto-scrolls to
   the newest. Not a uniform list, which is why it is not row-virtualized. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from '@/lib/markdown/Markdown';
import remarkGfm from 'remark-gfm';
import {
  acpAgentLabel,
  acpWorkspaceCwd,
  buildAcpWebSocketUrl,
  diffFromAcpUpdate,
  sceneFromAcpUpdate,
  textFromAcpUpdate,
  type AcpAgentId,
  type AcpCommandApproval,
  type AcpCommandOutput,
  type AcpConnectionStatus,
  type AcpFileWriteReview,
  type AcpFrontendEvent,
} from '@/lib/commonplace-acp';
import { createInquiry } from '@/lib/inquiry-api';
import {
  claimsFromInquirySnapshot,
  groundedChatPrompt,
} from '@/lib/inquiry-agent-bridge';
import type { InquirySnapshot } from '@/lib/inquiry-types';
import { runTheoremAgent } from '@/lib/theorem-agent';
import type { RenderScenePayload } from '@/lib/scene-package';
import AgentThreadOmnibar from './AgentThreadOmnibar';
import SceneHost from '../scene-host/SceneHost';
import styles from './AgentThreadView.module.css';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import { useWaitTier } from '@/lib/commonplace-wait-tier';
import { narrationFor } from '@/lib/commonplace-wait-narration';
import PresenceMark from '../presence/PresenceMark';
import type { PresenceState } from '../presence/presenceStates';

type ThreadItem =
  | {
      id: string;
      kind: 'message';
      role: 'user' | 'agent' | 'system';
      markdown: string;
    }
  | {
      id: string;
      kind: 'diff';
      title: string;
      diff: string;
    }
  | {
      id: string;
      kind: 'file_write';
      event: AcpFileWriteReview;
    }
  | {
      id: string;
      kind: 'command';
      event: AcpCommandApproval;
      output?: AcpCommandOutput['output'];
    }
  | {
      id: string;
      kind: 'tool';
      title: string;
      payload: unknown;
    }
  | {
      id: string;
      kind: 'scene';
      payload: RenderScenePayload;
    };

interface AgentThreadViewProps {
  agentId?: AcpAgentId | string;
  agentMode?: 'api' | 'acp';
}

export default function AgentThreadView({
  agentId = 'theorem',
  agentMode,
}: AgentThreadViewProps) {
  const preferredMode = agentMode ?? (agentId === 'agent' ? 'api' : 'acp');
  const [apiFallback, setApiFallback] = useState(false);
  const resolvedMode = apiFallback ? 'api' : preferredMode;
  const agentLabel = useMemo(
    () =>
      agentId === 'theorem' || agentId === 'composed'
        ? acpAgentLabel(agentId)
        : resolvedMode === 'api'
          ? 'CommonPlace'
          : acpAgentLabel(agentId),
    [agentId, resolvedMode],
  );
  const wsRef = useRef<WebSocket | null>(null);
  const sessionStartedRef = useRef(false);
  const fallbackStartedRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<AcpConnectionStatus>(
    resolvedMode === 'api' ? 'connected' : 'connecting',
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [composer, setComposer] = useState('');
  const [isSending, setIsSending] = useState(false);

  const addItem = useCallback((item: ThreadItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const activateApiFallback = useCallback(
    (reason: string) => {
      if (fallbackStartedRef.current) return;
      fallbackStartedRef.current = true;
      setStatus('connected');
      setApiFallback(true);
      addItem({
        id: `fallback-${Date.now()}`,
        kind: 'message',
        role: 'system',
        markdown: `${reason} Continuing through Theorem's JSON compatibility route.`,
      });
    },
    [addItem],
  );

  const send = useCallback((payload: unknown) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const handleEvent = useCallback(
    (event: AcpFrontendEvent) => {
      if (event.type === 'session_started') {
        sessionStartedRef.current = true;
        setSessionId(event.session_id);
        setStatus('connected');
        addItem({
          id: `started-${event.session_id}`,
          kind: 'message',
          role: 'system',
          markdown: `${acpAgentLabel(event.agent_id)} joined the workspace.`,
        });
        return;
      }

      if (event.type === 'session_update') {
        const diff = diffFromAcpUpdate(event.update);
        if (diff) {
          addItem({
            id: `diff-${Date.now()}`,
            kind: 'diff',
            title: 'Proposed change',
            diff,
          });
          return;
        }

        const scene = sceneFromAcpUpdate(event.update);
        if (scene) {
          addItem({
            id: `scene-${Date.now()}`,
            kind: 'scene',
            payload: scene,
          });
          return;
        }

        const text = textFromAcpUpdate(event.update);
        if (text) {
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last?.kind === 'message' && last.role === 'agent') {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  markdown: `${last.markdown}${text}`,
                },
              ];
            }
            return [
              ...prev,
              {
                id: `agent-${Date.now()}`,
                kind: 'message',
                role: 'agent',
                markdown: text,
              },
            ];
          });
          return;
        }

        addItem({
          id: `tool-${Date.now()}`,
          kind: 'tool',
          title: 'Session update',
          payload: event.update,
        });
        return;
      }

      if (event.type === 'file_write_review') {
        addItem({
          id: `file-${event.review.request_id}`,
          kind: 'file_write',
          event,
        });
        return;
      }

      if (event.type === 'command_approval') {
        addItem({
          id: `cmd-${event.approval.terminal_id}`,
          kind: 'command',
          event,
        });
        return;
      }

      if (event.type === 'command_output') {
        setItems((prev) =>
          prev.map((item) =>
            item.kind === 'command' &&
            item.event.approval.terminal_id === event.output.terminal_id
              ? { ...item, output: event.output }
              : item,
          ),
        );
        return;
      }

      if (event.type === 'error') {
        if (agentId === 'theorem' && !sessionStartedRef.current) {
          activateApiFallback(`The real-time Theorem session could not start: ${event.message}`);
          return;
        }
        addItem({
          id: `error-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown: event.message,
        });
      }
    },
    [activateApiFallback, addItem, agentId],
  );

  useEffect(() => {
    if (resolvedMode === 'api') {
      wsRef.current = null;
      return;
    }

    const socket = new WebSocket(buildAcpWebSocketUrl());
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'start_session',
          agent_id: agentId,
          cwd: acpWorkspaceCwd(),
        }),
      );
    };
    socket.onmessage = (message) => {
      try {
        handleEvent(JSON.parse(message.data) as AcpFrontendEvent);
      } catch {
        addItem({
          id: `malformed-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown: 'Received an unreadable ACP event.',
        });
      }
    };
    socket.onerror = () => {
      if (agentId === 'theorem' && !sessionStartedRef.current) {
        activateApiFallback('The real-time Theorem session is unavailable.');
        return;
      }
      setStatus('offline');
    };
    socket.onclose = () => {
      if (agentId === 'theorem' && !sessionStartedRef.current) {
        activateApiFallback('The real-time Theorem session closed during startup.');
        return;
      }
      setStatus((current) => (current === 'connected' ? 'offline' : current));
    };

    return () => {
      wsRef.current = null;
      socket.close();
    };
  }, [activateApiFallback, addItem, agentId, handleEvent, resolvedMode]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [items]);

  const sendPrompt = useCallback(async (options: { file?: File } = {}) => {
    if (isSending) return;
    const text = composer.trim();
    if (!text) return;
    const promptText = options.file
      ? `${text}\n\nAttached file: ${options.file.name}`
      : text;
    const activeSession = sessionId ?? 'pending';
    addItem({
      id: `user-${Date.now()}`,
      kind: 'message',
      role: 'user',
      markdown: promptText,
    });
    setComposer('');

    let snapshot: InquirySnapshot | null = null;
    try {
      const inquiry = await createInquiry({
        query: promptText,
        surface: 'chat',
        retrieval_budget: 'standard',
      });
      snapshot = inquiry.snapshot;
      const evidenceCount = snapshot.evidence.length;
      if (evidenceCount > 0) {
        addItem({
          id: `retrieve-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown: `Retrieved ${evidenceCount} source${evidenceCount === 1 ? '' : 's'}.`,
        });
      }
    } catch {
      addItem({
        id: `retrieve-fail-${Date.now()}`,
        kind: 'message',
        role: 'system',
        markdown: 'Inquiry retrieval failed; continuing with your message to Theorem.',
      });
    }

    const claims = snapshot ? claimsFromInquirySnapshot(snapshot) : [];
    const agentPrompt = snapshot ? groundedChatPrompt(promptText, snapshot) : promptText;

    const useCompatibilityRoute =
      resolvedMode === 'api' || (agentId === 'theorem' && !sessionId);
    if (useCompatibilityRoute) {
      if (resolvedMode === 'acp') {
        activateApiFallback('The real-time Theorem session was not ready for this message.');
      }
      setStatus('connecting');
      setIsSending(true);
      try {
        const result = await runTheoremAgent({
          task: promptText,
          mode: 'ask',
          claims: claims.length > 0 ? claims : undefined,
        });
        addItem({
          id: `agent-${Date.now()}`,
          kind: 'message',
          role: 'agent',
          markdown: result.answer || 'I did not get an answer back.',
        });
      } catch (err) {
        addItem({
          id: `error-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown:
            resolvedMode === 'api'
              ? 'I could not reach the agent right now. Check Accounts when you are ready to reconnect.'
              : err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsSending(false);
        setStatus('connected');
      }
      return;
    }

    const delivered = send({
      type: 'prompt',
      session_id: activeSession,
      text: agentPrompt,
    });
    if (!delivered) {
      addItem({
        id: `offline-${Date.now()}`,
        kind: 'message',
        role: 'system',
        markdown: 'ACP host is offline.',
      });
    }
  }, [activateApiFallback, addItem, agentId, composer, isSending, resolvedMode, send, sessionId]);

  const displayStatus =
    resolvedMode === 'api' && status !== 'connecting' ? 'connected' : status;

  // WL-4b: the compatibility route is non-streaming, so its send-to-answer wait
  // is a pre-stream window. Promote the pending indicator through the wait
  // ladder on real elapsed time (T0 nothing, T1 micro line, T2 spinner + narration).
  const waitTier = useWaitTier(isSending);
  // The Presence mark is the header presence glyph (SPEC-UI-SOURCING-ADDENDUM
  // Presence D2): the same mark as the co-browse telegraph and the run glyph.
  const markState: PresenceState =
    displayStatus === 'connecting' ? 'thinking' : displayStatus === 'offline' ? 'interrupted' : 'idle';

  return (
    <section className={`cp-agent-thread ${styles.thread}`} aria-label={`${agentLabel} agent thread`}>
      {preferredMode === 'acp' ? (
        <header className="cp-agent-thread-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PresenceMark state={markState} size={24} label={`${agentLabel} presence`} />
            <h2>{agentLabel}</h2>
            <span className={`cp-agent-thread-status cp-agent-thread-status--${displayStatus}`}>
              {displayStatus}
            </span>
          </div>
          {sessionId && <code>{sessionId}</code>}
        </header>
      ) : null}

      <div ref={listRef} className={`cp-agent-thread-list ${styles.threadList}`}>
        {items.map((item) => (
          <ThreadCard
            key={item.id}
            item={item}
            onApproveCommand={(terminalId) =>
              send({ type: 'approve_command', session_id: sessionId, terminal_id: terminalId })
            }
            onDenyCommand={(terminalId) =>
              send({ type: 'deny_command', session_id: sessionId, terminal_id: terminalId })
            }
            onApproveFile={(requestId) =>
              send({ type: 'approve_file_write', session_id: sessionId, request_id: requestId })
            }
            onDenyFile={(requestId) =>
              send({ type: 'deny_file_write', session_id: sessionId, request_id: requestId })
            }
          />
        ))}
        {isSending && waitTier !== 'T0' ? (
          <article
            className={`cp-agent-message cp-agent-message--agent ${styles.pendingMessage}`}
            role="status"
            aria-label={narrationFor('agentRun', 0)}
          >
            {waitTier === 'T1' ? (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 12,
                  opacity: 0.7,
                  color: 'var(--cp-text-muted)',
                }}
              >
                {narrationFor('agentRun', 0)}
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <WeaveSpinner size="compact" />
                <span
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 12,
                    color: 'var(--cp-text-muted)',
                  }}
                >
                  {narrationFor('agentRun', 0)}
                </span>
              </span>
            )}
          </article>
        ) : null}
      </div>

      <div className={styles.composerDock}>
        <AgentThreadOmnibar
          busy={isSending}
          value={composer}
          onChange={setComposer}
          onSubmit={(options) => sendPrompt(options)}
        />
      </div>
    </section>
  );
}

function ThreadCard({
  item,
  onApproveCommand,
  onDenyCommand,
  onApproveFile,
  onDenyFile,
}: {
  item: ThreadItem;
  onApproveCommand: (terminalId: string) => void;
  onDenyCommand: (terminalId: string) => void;
  onApproveFile: (requestId: string) => void;
  onDenyFile: (requestId: string) => void;
}) {
  if (item.kind === 'message') {
    return (
      <article className={`cp-agent-message cp-agent-message--${item.role}`}>
        <Markdown remarkPlugins={[remarkGfm]}>{item.markdown}</Markdown>
      </article>
    );
  }

  if (item.kind === 'diff') {
    return (
      <article className="cp-agent-card cp-agent-card--diff">
        <div className="cp-agent-card-title">{item.title}</div>
        <pre>{item.diff}</pre>
      </article>
    );
  }

  if (item.kind === 'file_write') {
    const { review } = item.event;
    return (
      <article className="cp-agent-card cp-agent-card--file">
        <div className="cp-agent-card-title">File write</div>
        <code>{review.path}</code>
        <details>
          <summary>Proposed content</summary>
          <pre>{review.content}</pre>
        </details>
        <div className="cp-agent-card-actions">
          <button type="button" onClick={() => onApproveFile(review.request_id)}>
            Approve
          </button>
          <button type="button" onClick={() => onDenyFile(review.request_id)}>
            Deny
          </button>
        </div>
      </article>
    );
  }

  if (item.kind === 'command') {
    const { approval } = item.event;
    const commandLine = [approval.command, ...(approval.args ?? [])].join(' ');
    return (
      <article className="cp-agent-card cp-agent-card--command">
        <div className="cp-agent-card-title">Command request</div>
        <code>{commandLine}</code>
        {approval.cwd && <span className="cp-agent-card-meta">{approval.cwd}</span>}
        {!item.output ? (
          <div className="cp-agent-card-actions">
            <button type="button" onClick={() => onApproveCommand(approval.terminal_id)}>
              Approve
            </button>
            <button type="button" onClick={() => onDenyCommand(approval.terminal_id)}>
              Deny
            </button>
          </div>
        ) : (
          <details open>
            <summary>Output</summary>
            <pre>{[item.output.stdout, item.output.stderr].filter(Boolean).join('\n')}</pre>
          </details>
        )}
      </article>
    );
  }

  if (item.kind === 'scene') {
    return <SceneHost payload={item.payload} />;
  }

  return (
    <article className="cp-agent-card">
      <div className="cp-agent-card-title">{item.title}</div>
      <pre>{JSON.stringify(item.payload, null, 2)}</pre>
    </article>
  );
}
