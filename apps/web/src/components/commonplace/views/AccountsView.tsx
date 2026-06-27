'use client';

import type { CSSProperties } from 'react';
import AgentThreadView from './AgentThreadView';

const accountSections = [
  {
    id: 'accounts-providers',
    title: 'Providers',
    rows: ['OpenAI', 'Anthropic', 'DeepSeek', 'Gemini', 'Ollama'],
  },
  {
    id: 'accounts-connections',
    title: 'Connections',
    rows: ['Hosted Theorem', 'Local node', 'ACP bridge', 'CommonPlace API'],
  },
  {
    id: 'accounts-keys',
    title: 'Keys',
    rows: ['Bearer token', 'Provider secrets', 'Desktop keychain'],
  },
  {
    id: 'accounts-usage',
    title: 'Usage',
    rows: ['Agent runs', 'Substrate reads', 'Model calls'],
  },
];

const agentLaunches = [
  { label: 'Theorem Agent', mode: 'api' },
  { label: 'Claude Code', mode: 'acp' },
  { label: 'Codex', mode: 'acp' },
  { label: 'Gemini CLI', mode: 'acp' },
];

export default function AccountsView() {
  return (
    <section style={styles.shell} aria-label="CommonPlace accounts">
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>SYSTEM</p>
          <h1 style={styles.title}>Accounts</h1>
        </div>
        <div style={styles.statusRow}>
          <span style={styles.status}>CommonPlace account</span>
          <span style={styles.status}>agent-ready</span>
        </div>
      </header>

      <div style={styles.body}>
        <main style={styles.agentColumn}>
          <div style={styles.columnHeader}>
            <span>Theorem Agent</span>
            <code style={styles.endpoint}>/api/theorem/agent</code>
          </div>
          <div style={styles.agentFrame}>
            <AgentThreadView agentId="theorem" agentMode="api" />
          </div>
        </main>

        <aside style={styles.controlColumn}>
          <section style={styles.panel}>
            <div style={styles.panelTitle}>Agents</div>
            <div style={styles.agentGrid}>
              {agentLaunches.map((agent) => (
                <div key={agent.label} style={styles.agentTile}>
                  <span style={styles.agentName}>{agent.label}</span>
                  <span style={styles.agentMode}>{agent.mode}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.sectionGrid}>
            {accountSections.map((section) => (
              <article id={section.id} key={section.title} style={styles.panel}>
                <div style={styles.panelTitle}>{section.title}</div>
                <div style={styles.rowList}>
                  {section.rows.map((row) => (
                    <div key={row} style={styles.controlRow}>
                      <span>{row}</span>
                      <span style={styles.dot} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
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
    padding: '18px 20px 14px',
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
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: 0,
    color: 'var(--cp-text)',
  },
  statusRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  status: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '6px 8px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-card)',
    overflowWrap: 'anywhere',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr)',
    minHeight: 0,
    flex: 1,
  },
  agentColumn: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    borderRight: '1px solid var(--cp-border)',
    background: 'var(--cp-surface)',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderBottom: '1px solid var(--cp-border)',
    fontFamily: 'var(--cp-font-title)',
    fontSize: 15,
    color: 'var(--cp-text)',
  },
  endpoint: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  agentFrame: {
    minHeight: 0,
    flex: 1,
    overflow: 'hidden',
  },
  controlColumn: {
    minWidth: 0,
    overflowY: 'auto',
    padding: 14,
    background: 'var(--cp-card)',
  },
  panel: {
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--cp-surface)',
  },
  panelTitle: {
    marginBottom: 10,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    letterSpacing: 0,
    color: 'var(--cp-text-muted)',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  agentTile: {
    minWidth: 0,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 10,
    background: 'var(--cp-bg)',
  },
  agentName: {
    display: 'block',
    marginBottom: 5,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 14,
    color: 'var(--cp-text)',
    overflowWrap: 'anywhere',
  },
  agentMode: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-teal-light)',
  },
  sectionGrid: {
    display: 'grid',
    gap: 10,
    marginTop: 10,
  },
  rowList: {
    display: 'grid',
    gap: 6,
  },
  controlRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
    padding: '7px 0',
    borderBottom: '1px solid var(--cp-border)',
    fontFamily: 'var(--cp-font-body)',
    fontSize: 13,
    color: 'var(--cp-text-muted)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
    background: 'var(--cp-green)',
  },
};
