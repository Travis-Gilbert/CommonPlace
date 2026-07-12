'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { getBundle } from '@/lib/carry/bundle-store';
import { compileBundle, type CitedPacket, type CitedRecord } from '@/lib/carry/compile';
import { buildContextPrelude, citedReference } from '@/lib/carry/seed-build';
import { appendRailEntry } from '@/lib/carry/session-rail';
import { SessionRail } from '@/components/commonplace/rail/SessionRail';
import AgentThreadView from './AgentThreadView';

const trackedScopes = [
  { label: 'CommonPlace app', path: 'apps/web', state: 'active' },
  { label: 'Agent route', path: '/api/theorem/agent', state: 'wired' },
  { label: 'ACP dock', path: '/api/commonplace/acp/ws', state: 'available' },
  { label: 'Rust substrate', path: 'crates/commonplace-*', state: 'indexed' },
];

function recordTitle(record: CitedRecord): string {
  return (record.metadata.sourceTitle as string | undefined) ?? String(record.metadata.sourceUrl ?? 'source');
}

export default function CodeWorkspaceView({
  carrySessionId,
}: {
  /** Present when reached via Carry to Build (HANDOFF-CARRY D3). */
  carrySessionId?: string | null;
}) {
  const [packet, setPacket] = useState<CitedPacket | null>(null);
  const [insertText, setInsertText] = useState<{ text: string; nonce: number } | null>(null);

  // Carry to Build (C3.1/C3.3): compile the carried bundle once, then load its
  // cited context into the agent. No generation happens here (C3.4).
  useEffect(() => {
    if (!carrySessionId) return;
    let cancelled = false;
    void (async () => {
      const bundle = await getBundle(carrySessionId);
      if (!bundle || bundle.items.length === 0 || cancelled) return;
      const compiled = await compileBundle(bundle);
      if (cancelled) return;
      setPacket(compiled);
      await appendRailEntry(carrySessionId, {
        kind: 'destination',
        summary: `Loaded ${compiled.records.length} cited ${compiled.records.length === 1 ? 'source' : 'sources'} into the coding agent`,
        receipt: { bundleId: carrySessionId, records: compiled.records.length },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [carrySessionId]);

  const seedContext = useMemo(() => (packet ? buildContextPrelude(packet) : undefined), [packet]);

  const insertRecord = (record: CitedRecord) => {
    setInsertText({ text: citedReference(record), nonce: Date.now() });
  };

  return (
    <section style={styles.shell} aria-label="CommonPlace code workspace">
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>WORKSPACE</p>
          <h1 style={styles.title}>Code</h1>
        </div>
        <div style={styles.badgeRow}>
          <span style={styles.badge}>CommonPlace Chat</span>
          <span style={styles.badge}>ACP</span>
        </div>
      </header>

      <div style={styles.grid}>
        <aside style={styles.scopePanel} aria-label="Repository scopes">
          <div style={styles.panelHeader}>Scopes</div>
          <div style={styles.scopeList}>
            {trackedScopes.map((scope) => (
              <article key={scope.path} style={styles.scopeItem}>
                <div>
                  <div style={styles.scopeLabel}>{scope.label}</div>
                  <code style={styles.scopePath}>{scope.path}</code>
                </div>
                <span style={styles.statePill}>{scope.state}</span>
              </article>
            ))}
          </div>
        </aside>

        <main style={styles.agentPanel} aria-label="Code agent">
          <AgentThreadView
            agentId="theorem"
            agentMode="api"
            seedContext={seedContext}
            insertText={insertText}
          />
        </main>

        <aside style={styles.runPanel} aria-label="Carried bundle">
          <div style={styles.panelHeader}>Bundle</div>
          {packet && packet.records.length > 0 ? (
            <>
              <div style={styles.bundleList}>
                {packet.records.map((record) => (
                  <article key={record.id} style={styles.bundleItem}>
                    <div style={styles.bundleTitle}>{recordTitle(record)}</div>
                    {record.metadata.sourceUrl ? (
                      <code style={styles.scopePath}>{String(record.metadata.sourceUrl)}</code>
                    ) : null}
                    {record.content ? <p style={styles.bundleQuote}>{record.content}</p> : null}
                    <button type="button" style={styles.insertButton} onClick={() => insertRecord(record)}>
                      Insert as cited reference
                    </button>
                  </article>
                ))}
              </div>
              {carrySessionId ? (
                <div style={{ marginTop: 14 }}>
                  <SessionRail sessionId={carrySessionId} title="Session" />
                </div>
              ) : null}
            </>
          ) : (
            <p style={styles.emptyState}>
              No bundle carried into this workspace. Carry a browsing session here to cite its
              sources.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    background: 'var(--cp-bg)',
    color: 'var(--cp-text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '16px 18px 12px',
    borderBottom: '1px solid var(--cp-border)',
    background: 'var(--cp-surface)',
  },
  eyebrow: {
    margin: '0 0 4px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    letterSpacing: 0,
    color: 'var(--cp-text-faint)',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 26,
    fontWeight: 600,
    letterSpacing: 0,
    color: 'var(--cp-text)',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  badge: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '6px 8px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-card)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.65fr) minmax(0, 1.8fr) minmax(0, 0.8fr)',
    minHeight: 0,
    flex: 1,
  },
  scopePanel: {
    minWidth: 0,
    padding: 14,
    borderRight: '1px solid var(--cp-border)',
    background: 'var(--cp-card)',
    overflowY: 'auto',
  },
  agentPanel: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--cp-surface)',
  },
  runPanel: {
    minWidth: 0,
    padding: 14,
    borderLeft: '1px solid var(--cp-border)',
    background: 'var(--cp-card)',
    overflowY: 'auto',
  },
  panelHeader: {
    marginBottom: 10,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    letterSpacing: 0,
    color: 'var(--cp-text-muted)',
  },
  scopeList: {
    display: 'grid',
    gap: 8,
  },
  scopeItem: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    background: 'var(--cp-surface)',
  },
  scopeLabel: {
    marginBottom: 4,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 14,
    color: 'var(--cp-text)',
  },
  scopePath: {
    display: 'block',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  statePill: {
    flexShrink: 0,
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '3px 6px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-teal-light)',
    background: 'var(--cp-bg)',
  },
  bundleList: {
    display: 'grid',
    gap: 8,
  },
  bundleItem: {
    display: 'grid',
    gap: 4,
    padding: 10,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    background: 'var(--cp-surface)',
  },
  bundleTitle: {
    fontFamily: 'var(--cp-font-title)',
    fontSize: 13,
    color: 'var(--cp-text)',
  },
  bundleQuote: {
    margin: '2px 0 4px',
    fontFamily: 'var(--cp-font-body)',
    fontSize: 12,
    color: 'var(--cp-text-muted)',
    overflowWrap: 'anywhere',
  },
  insertButton: {
    justifySelf: 'start',
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '4px 8px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text)',
    background: 'var(--cp-bg)',
    cursor: 'pointer',
  },
  emptyState: {
    margin: 0,
    fontFamily: 'var(--cp-font-body)',
    fontSize: 12,
    color: 'var(--cp-text-faint)',
    lineHeight: 1.5,
  },
};
