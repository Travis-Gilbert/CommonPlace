'use client';

/**
 * Agent Workroom Control Center (app.theoremharness.com).
 *
 * The CommonPlace product control room for durable agent work. One GET to
 * /api/theorem/control-center yields the whole TheoremControlCenterState;
 * typed POST actions return durable receipts. Backend (Codex lane) swaps the
 * fixture sources for live Theorem substrate behind the same DTOs, so every
 * card degrades honestly via its source.mode until then.
 *
 * Parity checklist: PT-003 Workrooms, PT-004 Receipts, PT-005 Approvals,
 * PT-006 Routes, PT-007 Setup, PT-008 Commands, PT-009 Memory,
 * PT-010 Tools, PT-011 Skill candidates, PT-012 Reconstruction, PT-013 Eval.
 */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useApiData } from '@/lib/commonplace-api';
import {
  fetchControlCenterState,
  postControlCenterAction,
} from '@/lib/theorem-control-center-client';
import type {
  ApprovalCard,
  ControlCenterSource,
  ControlCenterStatus,
  MemoryBlock,
  Receipt,
  ReconstructionPacket,
  RiskClass,
  RouteCard,
  SetupCheck,
  SkillCandidate,
  TheoremControlCenterAction,
  ToolConnection,
  WorkroomSummary,
} from '@/lib/theorem-control-center';
import styles from './control-center.module.css';

type SectionId =
  | 'workrooms'
  | 'approvals'
  | 'receipts'
  | 'routes'
  | 'memory'
  | 'tools'
  | 'setup'
  | 'commands';

/* status/risk/tier -> parchment tone -------------------------------------- */

function statusTone(status: ControlCenterStatus | string): string {
  switch (status) {
    case 'ready':
    case 'passed':
    case 'approved':
    case 'active':
    case 'pinned':
      return 'green';
    case 'warning':
    case 'pending':
    case 'review':
    case 'running':
    case 'queued':
      return 'amber';
    case 'blocked':
    case 'denied':
    case 'failed':
      return 'red';
    default:
      return 'steel';
  }
}

function riskTone(risk: RiskClass): string {
  switch (risk) {
    case 'read':
      return 'steel';
    case 'write':
      return 'amber';
    case 'network':
      return 'blue';
    case 'install':
      return 'gold';
    case 'destructive':
      return 'red';
    default:
      return 'steel';
  }
}

function tierTone(tier: string): string {
  switch (tier) {
    case 'trusted_local':
      return 'green';
    case 'sandboxed':
      return 'amber';
    case 'denied':
      return 'red';
    default:
      return 'steel';
  }
}

/* small primitives -------------------------------------------------------- */

function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

function SourceBadge({ source }: { source: ControlCenterSource }) {
  return (
    <span
      className={styles.sourceBadge}
      data-mode={source.mode}
      title={source.message ?? source.endpoint ?? source.label}
    >
      {source.mode}
    </span>
  );
}

function Dot({ status }: { status: ControlCenterStatus | string }) {
  return <span className={styles.dot} data-status={status} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

/* ------------------------------------------------------------------------- */

export default function AgentWorkroomControlCenter() {
  const { data, loading, error, refetch } = useApiData(
    () => fetchControlCenterState(),
    [],
  );
  const [section, setSection] = useState<SectionId>('workrooms');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const runAction = useCallback(
    async (action: TheoremControlCenterAction, key: string) => {
      setBusy(key);
      setActionMsg(null);
      try {
        const result = await postControlCenterAction(action);
        setActionMsg(result.message);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
        refetch();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionMsg(message);
        toast.error(message);
      } finally {
        setBusy(null);
      }
    },
    [refetch],
  );

  const counts = useMemo(() => {
    if (!data) return {} as Record<SectionId, number>;
    return {
      workrooms: data.workrooms.length,
      approvals: data.approvals.filter((a) => a.status === 'pending').length,
      receipts: data.receipts.length,
      routes: data.routes.length,
      memory: data.memory.blocks.length,
      tools: data.tools.length,
      setup: data.setup.length,
      commands: data.commands.length,
    } as Record<SectionId, number>;
  }, [data]);

  const tabs: Array<{ id: SectionId; label: string }> = [
    { id: 'workrooms', label: 'Workrooms' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'routes', label: 'Routes' },
    { id: 'memory', label: 'Memory' },
    { id: 'tools', label: 'Tools' },
    { id: 'setup', label: 'Setup' },
    { id: 'commands', label: 'Commands' },
  ];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>Agent Workroom Control Center</h1>
          <div className={styles.subtitle}>
            <span className={styles.surfacePill}>
              {data?.targetSurface ?? 'app.theoremharness.com'}
            </span>
            <span>Durable agent work: runs, approvals, receipts, routes, memory.</span>
            {data && <SourceBadge source={data.source} />}
          </div>
        </div>
        <div className={styles.headerAside}>
          {data && (
            <span className={styles.health}>
              <Dot status={data.health.status} />
              {data.health.summary}
            </span>
          )}
          <button
            className={styles.refresh}
            onClick={() => refetch()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <nav className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${section === t.id ? styles.tabActive : ''}`}
            onClick={() => setSection(t.id)}
          >
            {t.label}
            {counts[t.id] ? <span className={styles.tabCount}>{counts[t.id]}</span> : null}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}
        {error && (
          <div className={styles.errorCard}>
            Control center unavailable: {error.message}
          </div>
        )}
        {loading && !data && <div className={styles.loading}>Loading control center...</div>}
        {data && (
          <>
            {section === 'workrooms' && (
              <Workrooms data={data} busy={busy} run={runAction} />
            )}
            {section === 'approvals' && (
              <Approvals items={data.approvals} busy={busy} run={runAction} />
            )}
            {section === 'receipts' && <Receipts items={data.receipts} />}
            {section === 'routes' && (
              <Routes items={data.routes} busy={busy} run={runAction} />
            )}
            {section === 'memory' && (
              <Memory memory={data.memory} busy={busy} run={runAction} />
            )}
            {section === 'tools' && (
              <Tools
                tools={data.tools}
                candidates={data.skillCandidates}
                packets={data.reconstructionPackets}
                busy={busy}
                run={runAction}
              />
            )}
            {section === 'setup' && (
              <Setup items={data.setup} busy={busy} run={runAction} />
            )}
            {section === 'commands' && <Commands items={data.commands} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

type Runner = (action: TheoremControlCenterAction, key: string) => void;

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={styles.sectionHead}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionHint}>{hint}</p>
    </div>
  );
}

/* PT-003 Workrooms + PT-013 Eval ------------------------------------------ */

function Workrooms({
  data,
  busy,
  run,
}: {
  data: { workrooms: WorkroomSummary[] };
  busy: string | null;
  run: Runner;
}) {
  const { workrooms } = data;
  return (
    <section>
      <SectionHead
        title="Workrooms"
        hint="Durable run ledger. Each workroom carries a run id, actor/head, state, latest receipt, artifacts, and eval. Run-mutating actions unlock once the live backend is wired."
      />
      {workrooms.length === 0 ? (
        <Empty>No workrooms yet.</Empty>
      ) : (
        <div className={`${styles.grid} ${styles.gridCols}`}>
          {workrooms.map((w) => {
            const live = w.source.mode === 'live';
            return (
              <article key={w.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>{w.title}</span>
                  <Pill tone={statusTone(w.state)}>{w.state}</Pill>
                </div>
                <div className={styles.cardSummary}>{w.task}</div>
                <div className={styles.cardMeta}>
                  <span className={`${styles.mono} ${styles.dim}`}>{w.id}</span>
                  <Pill>{w.actor} / {w.head}</Pill>
                  <span className={`${styles.mono} ${styles.muted}`}>
                    {w.artifactCount} artifacts
                  </span>
                  {w.eval && <Pill tone={statusTone(w.eval.status)}>eval: {w.eval.status}</Pill>}
                  {w.fitness != null && (
                    <span className={`${styles.mono} ${styles.muted}`}>fitness {w.fitness}</span>
                  )}
                  <SourceBadge source={w.source} />
                </div>
                <div className={styles.actions}>
                  {w.actions.map((a) => (
                    <button
                      key={a}
                      className={styles.btn}
                      disabled={!live}
                      title={live ? '' : 'Enabled once the live run backend is wired.'}
                    >
                      {a}
                    </button>
                  ))}
                  <button
                    className={styles.btn}
                    disabled={busy === `eval:${w.id}`}
                    onClick={() =>
                      run({ action: 'eval_trace_export', workroomId: w.id }, `eval:${w.id}`)
                    }
                  >
                    export trace
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* PT-005 Approvals -------------------------------------------------------- */

function Approvals({
  items,
  busy,
  run,
}: {
  items: ApprovalCard[];
  busy: string | null;
  run: Runner;
}) {
  const pending = items.filter((a) => a.status === 'pending');
  const history = items.filter((a) => a.status !== 'pending');
  return (
    <section>
      <SectionHead
        title="Approval Inbox"
        hint="Pending and historical command / file / tool approvals. Each shows risk class, execution isolation tier, and a durable audit row. Remember applies to this tool and target only."
      />
      {items.length === 0 ? (
        <Empty>No approvals.</Empty>
      ) : (
        <div className={`${styles.grid} ${styles.gridCols}`}>
          {[...pending, ...history].map((a) => {
            const isPending = a.status === 'pending';
            return (
              <article
                key={a.id}
                className={`${styles.card} ${isPending ? styles.cardPending : ''}`}
              >
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>{a.title}</span>
                  <Pill tone={statusTone(a.status)}>{a.status}</Pill>
                </div>
                <div className={styles.cardSummary}>{a.summary}</div>
                {a.diffSummary && (
                  <div className={`${styles.mono} ${styles.muted}`} style={{ marginTop: 6 }}>
                    {a.diffSummary}
                  </div>
                )}
                {a.commandSummary && (
                  <div className={`${styles.mono} ${styles.muted}`} style={{ marginTop: 6 }}>
                    $ {a.commandSummary}
                  </div>
                )}
                <div className={styles.cardMeta}>
                  <Pill tone={riskTone(a.riskClass)}>{a.riskClass}</Pill>
                  <Pill tone={tierTone(a.isolationTier)}>{a.isolationTier}</Pill>
                  <span className={`${styles.mono} ${styles.dim}`}>{a.toolName}</span>
                  <SourceBadge source={a.source} />
                </div>
                <div className={styles.kv}>
                  <span className={styles.kvKey}>requested</span>
                  <span className={styles.kvVal}>{a.requestedBy}</span>
                  <span className={styles.kvKey}>target</span>
                  <span className={`${styles.kvVal} ${styles.mono}`}>{a.target}</span>
                </div>
                {isPending && (
                  <div className={styles.actions}>
                    {a.actions.includes('approve_once') && (
                      <button
                        className={styles.btnPrimary}
                        disabled={busy === `ap:${a.id}`}
                        onClick={() =>
                          run(
                            { action: 'approval_decision', approvalId: a.id, decision: 'approve_once' },
                            `ap:${a.id}`,
                          )
                        }
                      >
                        approve once
                      </button>
                    )}
                    {a.actions.includes('remember') && (
                      <button
                        className={styles.btn}
                        disabled={busy === `ap:${a.id}`}
                        title={`Remember for ${a.toolName} on ${a.target}`}
                        onClick={() =>
                          run(
                            {
                              action: 'approval_decision',
                              approvalId: a.id,
                              decision: 'remember',
                              rememberScope: `${a.toolName}:${a.target}`,
                            },
                            `ap:${a.id}`,
                          )
                        }
                      >
                        remember
                      </button>
                    )}
                    {a.actions.includes('deny') && (
                      <button
                        className={styles.btnDanger}
                        disabled={busy === `ap:${a.id}`}
                        onClick={() =>
                          run(
                            { action: 'approval_decision', approvalId: a.id, decision: 'deny' },
                            `ap:${a.id}`,
                          )
                        }
                      >
                        deny
                      </button>
                    )}
                  </div>
                )}
                {a.audit.length > 0 && (
                  <div className={styles.audit}>
                    {a.audit.map((row, i) => (
                      <div key={i} className={styles.auditRow}>
                        <span>{row.at}</span>
                        <span>{row.actor}</span>
                        <span>{row.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* PT-004 Receipts --------------------------------------------------------- */

function Receipts({ items }: { items: Receipt[] }) {
  return (
    <section>
      <SectionHead
        title="Receipts"
        hint="Durable proof objects. Each answers what happened, what changed, who or what acted, and how to inspect or recover it without replaying the chat."
      />
      {items.length === 0 ? (
        <Empty>No receipts.</Empty>
      ) : (
        <div className={styles.grid}>
          {items.map((r) => (
            <article key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{r.title}</span>
                <Pill tone="teal">{r.kind}</Pill>
              </div>
              <div className={styles.cardSummary}>{r.summary}</div>
              <div className={styles.cardMeta}>
                <span className={`${styles.mono} ${styles.dim}`}>{r.id}</span>
                <Pill>{r.actor} / {r.head}</Pill>
                <span className={`${styles.mono} ${styles.muted}`}>{r.happenedAt}</span>
                <SourceBadge source={r.source} />
              </div>
              {r.inspect && (
                <div className={styles.kv}>
                  <span className={styles.kvKey}>inspect</span>
                  <span className={styles.kvVal}>
                    {r.inspect.href ? (
                      <a href={r.inspect.href} className={styles.mono}>{r.inspect.label}</a>
                    ) : (
                      r.inspect.label
                    )}
                    {r.inspect.bodyPreview && (
                      <div className={`${styles.mono} ${styles.dim}`} style={{ marginTop: 4 }}>
                        {r.inspect.bodyPreview}
                      </div>
                    )}
                  </span>
                </div>
              )}
              {r.changed.length > 0 && (
                <div className={styles.chips}>
                  {r.changed.map((c) => (
                    <span key={c} className={styles.chip}>{c}</span>
                  ))}
                </div>
              )}
              {r.recovery.length > 0 && (
                <div className={styles.chips}>
                  {r.recovery.map((c) => (
                    <span key={c} className={styles.chip}>↺ {c}</span>
                  ))}
                </div>
              )}
              {r.provenance.length > 0 && (
                <div className={`${styles.mono} ${styles.dim}`} style={{ marginTop: 8 }}>
                  {r.provenance.join(' · ')}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* PT-006 Routes ----------------------------------------------------------- */

function Routes({
  items,
  busy,
  run,
}: {
  items: RouteCard[];
  busy: string | null;
  run: Runner;
}) {
  return (
    <section>
      <SectionHead
        title="Provider Routes"
        hint="The resolved route before a run: provider, model, runtime, channel, endpoint kind, protocol, auth, context window, live counters, and cost source. Unknown cost is shown as unknown, never invented."
      />
      {items.length === 0 ? (
        <Empty>No routes.</Empty>
      ) : (
        <div className={`${styles.grid} ${styles.gridCols}`}>
          {items.map((r) => (
            <article key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{r.label}</span>
                <Pill tone={statusTone(r.status)}>{r.status}</Pill>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>provider</span>
                <span className={styles.kvVal}>{r.provider}</span>
                <span className={styles.kvKey}>model</span>
                <span className={`${styles.kvVal} ${styles.mono}`}>{r.model}</span>
                <span className={styles.kvKey}>runtime</span>
                <span className={styles.kvVal}>{r.runtime}</span>
                <span className={styles.kvKey}>channel</span>
                <span className={styles.kvVal}>{r.channel}</span>
                <span className={styles.kvKey}>protocol</span>
                <span className={styles.kvVal}>{r.protocol} · {r.endpointKind}</span>
                <span className={styles.kvKey}>auth</span>
                <span className={styles.kvVal}>{r.authState}</span>
                <span className={styles.kvKey}>context</span>
                <span className={styles.kvVal}>
                  {r.contextWindow != null ? `${r.contextWindow.toLocaleString()} tok` : 'unknown'}
                </span>
                <span className={styles.kvKey}>cost</span>
                <span className={styles.kvVal}>{r.cost.known ? r.cost.label : 'unknown'}</span>
              </div>
              <div className={styles.counters}>
                <div className={styles.counter}>
                  <div className={styles.counterVal}>{r.counters.requestsSeen ?? '—'}</div>
                  <div className={styles.counterKey}>requests</div>
                </div>
                <div className={styles.counter}>
                  <div className={styles.counterVal}>{r.counters.anthropicMessagesSeen ?? '—'}</div>
                  <div className={styles.counterKey}>anthropic</div>
                </div>
                <div className={styles.counter}>
                  <div className={styles.counterVal}>{r.counters.openaiResponsesSeen ?? '—'}</div>
                  <div className={styles.counterKey}>openai</div>
                </div>
              </div>
              <div className={styles.actions}>
                <SourceBadge source={r.source} />
                <button
                  className={styles.btn}
                  disabled={busy === `rt:${r.id}`}
                  onClick={() => run({ action: 'route_check', routeId: r.id }, `rt:${r.id}`)}
                >
                  check route
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* PT-009 Memory ----------------------------------------------------------- */

function Memory({
  memory,
  busy,
  run,
}: {
  memory: { contextBundles: import('@/lib/theorem-control-center').ContextBundle[]; blocks: MemoryBlock[] };
  busy: string | null;
  run: Runner;
}) {
  return (
    <section>
      <SectionHead
        title="Memory & Context Cockpit"
        hint="What context is admitted and why, with token footprint and provenance. Memory blocks are read-write: edit, pin, forget, or correct, each keeping receipted provenance."
      />
      <div className={styles.split}>
        <div>
          <h3 className={styles.colTitle}>Admitted context</h3>
          {memory.contextBundles.length === 0 ? (
            <Empty>No context bundles.</Empty>
          ) : (
            <div className={styles.grid}>
              {memory.contextBundles.map((b) => (
                <article key={b.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{b.label}</span>
                    <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                  </div>
                  <div className={`${styles.mono} ${styles.muted}`} style={{ marginTop: 6 }}>
                    {b.tokenEstimate != null ? `~${b.tokenEstimate} tok` : 'token footprint unknown'}
                  </div>
                  {b.admittedSources.map((s) => (
                    <div key={s.id} className={styles.kv}>
                      <span className={styles.kvKey}>{s.title}</span>
                      <span className={styles.kvVal}>
                        {s.reason}
                        <div className={`${styles.mono} ${styles.dim}`} style={{ marginTop: 2 }}>
                          {s.provenance.join(' · ')}
                        </div>
                      </span>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className={styles.colTitle}>Memory blocks</h3>
          {memory.blocks.length === 0 ? (
            <Empty>No memory blocks.</Empty>
          ) : (
            <div className={styles.grid}>
              {memory.blocks.map((m) => (
                <article key={m.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{m.title}</span>
                    <Pill tone={statusTone(m.status)}>{m.status}</Pill>
                  </div>
                  <div className={styles.cardSummary}>{m.preview}</div>
                  <div className={`${styles.mono} ${styles.dim}`} style={{ marginTop: 6 }}>
                    {m.provenance.join(' · ')}
                  </div>
                  <div className={styles.actions}>
                    {m.actions.map((act) => (
                      <button
                        key={act}
                        className={styles.btn}
                        disabled={busy === `mem:${m.id}`}
                        onClick={() =>
                          run(
                            { action: 'memory_action', blockId: m.id, memoryAction: act },
                            `mem:${m.id}`,
                          )
                        }
                      >
                        {act}
                      </button>
                    ))}
                    <SourceBadge source={m.source} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* PT-010 Tools + PT-011 Skill candidates + PT-012 Reconstruction ---------- */

function Tools({
  tools,
  candidates,
  packets,
  busy,
  run,
}: {
  tools: ToolConnection[];
  candidates: SkillCandidate[];
  packets: ReconstructionPacket[];
  busy: string | null;
  run: Runner;
}) {
  return (
    <section>
      <SectionHead
        title="Tools, Skills & Reconstruction"
        hint="MCP servers, skills, and connectors with health and permission summary. Secrets never enter browser-visible config. Skill candidates require a gate and shadow eval before activation."
      />
      <div className={styles.grid} style={{ marginBottom: 'var(--cp-space-6)' }}>
        {tools.length === 0 ? (
          <Empty>No tools connected.</Empty>
        ) : (
          <div className={`${styles.grid} ${styles.gridCols}`}>
            {tools.map((t) => (
              <article key={t.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>{t.label}</span>
                  <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                </div>
                <div className={styles.cardMeta}>
                  <Pill>{t.kind}</Pill>
                  {t.oauthRequired && <Pill tone="amber">oauth</Pill>}
                  <SourceBadge source={t.source} />
                </div>
                <div className={styles.cardSummary}>{t.permissionSummary}</div>
                {t.envHints.length > 0 && (
                  <div className={styles.chips}>
                    {t.envHints.map((e) => (
                      <span key={e} className={styles.chip}>{e}</span>
                    ))}
                  </div>
                )}
                <div className={styles.actions}>
                  <button
                    className={styles.btn}
                    disabled={busy === `tool:${t.id}`}
                    onClick={() =>
                      run({ action: 'tool_health_check', toolId: t.id }, `tool:${t.id}`)
                    }
                  >
                    health check
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={styles.split}>
        <div>
          <h3 className={styles.colTitle}>Skill candidates</h3>
          {candidates.length === 0 ? (
            <Empty>No candidates.</Empty>
          ) : (
            <div className={styles.grid}>
              {candidates.map((c) => (
                <article key={c.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{c.title}</span>
                    <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                  </div>
                  <div className={styles.cardMeta}>
                    <Pill tone="violet">{c.gate}</Pill>
                    {c.fitness != null && (
                      <span className={`${styles.mono} ${styles.muted}`}>fitness {c.fitness}</span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.btn}
                      disabled={busy === `sk:${c.id}`}
                      onClick={() =>
                        run(
                          { action: 'skill_candidate_action', candidateId: c.id, decision: 'shadow_eval' },
                          `sk:${c.id}`,
                        )
                      }
                    >
                      shadow eval
                    </button>
                    <button
                      className={styles.btnPrimary}
                      disabled={busy === `sk:${c.id}`}
                      onClick={() =>
                        run(
                          { action: 'skill_candidate_action', candidateId: c.id, decision: 'approve' },
                          `sk:${c.id}`,
                        )
                      }
                    >
                      approve
                    </button>
                    <button
                      className={styles.btnDanger}
                      disabled={busy === `sk:${c.id}`}
                      onClick={() =>
                        run(
                          { action: 'skill_candidate_action', candidateId: c.id, decision: 'reject' },
                          `sk:${c.id}`,
                        )
                      }
                    >
                      reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className={styles.colTitle}>Reconstruction packets</h3>
          {packets.length === 0 ? (
            <Empty>No packets.</Empty>
          ) : (
            <div className={styles.grid}>
              {packets.map((p) => (
                <article key={p.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{p.target}</span>
                    <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvKey}>oracle</span>
                    <span className={styles.kvVal}>{p.oracle}</span>
                  </div>
                  {p.evidence.length > 0 && (
                    <div className={styles.chips}>
                      {p.evidence.map((e) => (
                        <span key={e} className={styles.chip}>{e}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* PT-007 Setup ------------------------------------------------------------ */

function Setup({
  items,
  busy,
  run,
}: {
  items: SetupCheck[];
  busy: string | null;
  run: Runner;
}) {
  return (
    <section>
      <SectionHead
        title="Setup & Doctor"
        hint="Check-only readiness for node, proxy, provider auth, ACP, MCP, receiver, and GraphQL. No check starts a model or mutates config."
      />
      <div className={styles.actions} style={{ borderTop: 'none', paddingTop: 0, marginBottom: 'var(--cp-space-4)' }}>
        <button
          className={styles.btnPrimary}
          disabled={busy === 'setup:all'}
          onClick={() => run({ action: 'setup_check' }, 'setup:all')}
        >
          run all checks
        </button>
      </div>
      {items.length === 0 ? (
        <Empty>No setup checks.</Empty>
      ) : (
        <div className={`${styles.grid} ${styles.gridCols}`}>
          {items.map((c) => (
            <article key={c.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  <Dot status={c.status} /> {c.label}
                </span>
                {c.checkOnly && <Pill>check-only</Pill>}
              </div>
              <div className={`${styles.mono} ${styles.dim}`} style={{ marginTop: 6 }}>
                {c.target}
              </div>
              <div className={styles.cardSummary}>{c.message}</div>
              <div className={styles.actions}>
                <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                <button
                  className={styles.btn}
                  disabled={busy === `setup:${c.id}`}
                  onClick={() => run({ action: 'setup_check', checkId: c.id }, `setup:${c.id}`)}
                >
                  run check
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* PT-008 Commands (locus chips) ------------------------------------------- */

function Commands({
  items,
}: {
  items: import('@/lib/theorem-control-center').CommandCatalogItem[];
}) {
  const locusTone: Record<string, string> = {
    local: 'teal',
    agent: 'red',
    model: 'violet',
    admin: 'steel',
  };
  return (
    <section>
      <SectionHead
        title="Command Catalog"
        hint="Command palette catalog with locus chips: local product, agent, model, and admin. Each command discloses where it executes and what permission it may request."
      />
      {items.length === 0 ? (
        <Empty>No commands.</Empty>
      ) : (
        <div className={`${styles.grid} ${styles.gridCols}`}>
          {items.map((c) => (
            <article key={c.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{c.label}</span>
                <Pill tone={locusTone[c.locus] ?? 'steel'}>{c.locus}</Pill>
              </div>
              <div className={styles.cardSummary}>{c.description}</div>
              <div className={styles.cardMeta}>
                <Pill tone={riskTone(c.riskClass)}>{c.riskClass}</Pill>
                {c.routeId && <span className={`${styles.mono} ${styles.dim}`}>{c.routeId}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
