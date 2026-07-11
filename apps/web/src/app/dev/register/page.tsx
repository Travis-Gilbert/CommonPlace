'use client';

/**
 * CR1 — the axis playground.
 *
 * Live sliders over the console register's axes. Every change re-runs the same
 * solver that emits console-register.css, injects the result into a scoped
 * preview, and prints the contrast report. This is the ten-minute hue sweep:
 * find the ground that feels right, read the AA report, then paste the emitted
 * CSS into CONSOLE_AXES upstream (or copy the sheet) and rebuild. No color is
 * ever hand-picked; you move an axis and the whole console re-derives.
 *
 * Isolated by design: this route is outside the /v2 group, so it carries no
 * porcelain. The preview panel is the only thing --cr-* styles; the playground
 * chrome stays on neutral system defaults.
 */

import { useMemo, useState } from 'react';
import {
  type Axes,
  CONSOLE_AXES,
  emitCss,
  generateRegister,
  RegisterContrastError,
} from '@travis-gilbert/markdown-theory/tokens';

type AxisKey =
  | 'base'
  | 'measure'
  | 'hue'
  | 'chroma'
  | 'signalHue'
  | 'signalChroma'
  | 'linkHue'
  | 'linkChroma';

const SLIDERS: Array<{ key: AxisKey; label: string; min: number; max: number; step: number }> = [
  { key: 'base', label: 'Base size (px)', min: 13, max: 17, step: 0.5 },
  { key: 'measure', label: 'Measure (ch)', min: 45, max: 75, step: 1 },
  { key: 'hue', label: 'Surface hue', min: 0, max: 360, step: 1 },
  { key: 'chroma', label: 'Surface chroma', min: 0, max: 0.02, step: 0.001 },
  { key: 'signalHue', label: 'Signal hue', min: 0, max: 360, step: 1 },
  { key: 'signalChroma', label: 'Signal chroma', min: 0, max: 0.2, step: 0.005 },
  { key: 'linkHue', label: 'Link hue', min: 0, max: 360, step: 1 },
  { key: 'linkChroma', label: 'Link chroma', min: 0, max: 0.14, step: 0.005 },
];

export default function RegisterPlayground() {
  const [axes, setAxes] = useState<Axes>({ ...CONSOLE_AXES });

  const result = useMemo(() => {
    try {
      const reg = generateRegister(axes);
      return {
        ok: true as const,
        reg,
        previewCss: emitCss(reg, '.cr-preview', { prefix: 'cr' }),
        rootCss: emitCss(reg, ':root', { prefix: 'cr' }),
      };
    } catch (err) {
      const failures = err instanceof RegisterContrastError ? err.failures : [];
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false as const, message, failures };
    }
  }, [axes]);

  const set = (key: AxisKey, value: number) => setAxes((a) => ({ ...a, [key]: value }));
  const reset = () => setAxes({ ...CONSOLE_AXES });
  const copyRoot = () => {
    if (result.ok) void navigator.clipboard?.writeText(result.rootCss);
  };

  return (
    <div style={page}>
      {result.ok && <style dangerouslySetInnerHTML={{ __html: result.previewCss }} />}
      <div style={grid}>
        <section style={controls}>
          <header style={ctlHead}>
            <h1 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>Console register</h1>
            <span style={{ fontSize: 12, opacity: 0.6 }}>density: chrome · mode: light</span>
          </header>
          {SLIDERS.map((s) => (
            <label key={s.key} style={row}>
              <span style={rowLabel}>{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={axes[s.key]}
                onChange={(e) => set(s.key, Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <output style={rowVal}>{axes[s.key]}</output>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={reset} style={btn}>
              Reset to CONSOLE_AXES
            </button>
            <button type="button" onClick={copyRoot} disabled={!result.ok} style={btn}>
              Copy :root CSS
            </button>
          </div>

          <h2 style={h2}>Solver report</h2>
          {result.ok ? (
            <table style={table}>
              <tbody>
                {result.reg.contrast.map((c) => (
                  <tr key={c.pair}>
                    <td style={tdPair}>{c.pair}</td>
                    <td style={tdNum}>{c.wcag}:1</td>
                    <td style={{ ...tdBadge, color: c.passesAA ? '#0a7' : '#c33' }}>
                      {c.passesAA ? 'AA' : 'FAIL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={errBox}>
              <strong>Unsolvable register.</strong>
              <p style={{ margin: '6px 0' }}>{result.message}</p>
            </div>
          )}
        </section>

        <section className="cr-preview" style={preview}>
          {result.ok ? <PreviewCard /> : <div style={{ padding: 24 }}>—</div>}
        </section>
      </div>
    </div>
  );
}

/** A slice of console chrome, styled entirely through --cr-* tokens. */
function PreviewCard() {
  return (
    <div style={previewInner}>
      <div style={swatchRow}>
        {(['ground', 'surface', 'top', 'ink', 'ink-2', 'ink-3', 'signal', 'link'] as const).map(
          (name) => (
            <div key={name} style={swatch(name)}>
              <span style={swatchName}>{name}</span>
            </div>
          ),
        )}
      </div>

      <div style={sheet}>
        <div style={sheetTitle}>What landed</div>
        <p style={sheetBody}>
          Primary ink on the surface plane, solved to a confident off-black. Secondary and tertiary
          inks ladder down for apparatus.
        </p>
        <p style={sheetDim}>Provenance line · filed to Files / Zoning · ink-3</p>

        <div style={{ display: 'flex', gap: 'var(--cr-space-2)', marginTop: 'var(--cr-space-3)' }}>
          <button type="button" style={btnPrimary}>Confirm</button>
          <button type="button" style={btnSecondary}>Open</button>
          <button type="button" style={btnGhost}>Dismiss</button>
          <span style={chip}>needs you</span>
        </div>

        <div style={{ marginTop: 'var(--cr-space-3)' }}>
          {['Zoning variance filed', 'Council packet ingested', 'Two contradictions found'].map(
            (t) => (
              <div key={t} style={triageRow}>
                <span style={dot} />
                <span style={{ flex: 1 }}>{t}</span>
                <span style={rowMono}>run_7f3a</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- playground chrome (neutral, not part of the register) ---- */
const page: React.CSSProperties = {
  minHeight: '100dvh',
  background: '#f5f5f4',
  color: '#1c1c1a',
  fontFamily: 'system-ui, sans-serif',
  padding: 24,
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 380px) 1fr',
  gap: 24,
  maxWidth: 1200,
  margin: '0 auto',
  alignItems: 'start',
};
const controls: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e4e2',
  borderRadius: 10,
  padding: 20,
};
const ctlHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 14,
};
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' };
const rowLabel: React.CSSProperties = { width: 110, fontSize: 12, opacity: 0.8 };
const rowVal: React.CSSProperties = { width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 };
const btn: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 10px',
  border: '1px solid #d4d4d2',
  borderRadius: 6,
  background: '#fafafa',
  cursor: 'pointer',
};
const h2: React.CSSProperties = { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6, marginTop: 20 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const tdPair: React.CSSProperties = { padding: '4px 0' };
const tdNum: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.7 };
const tdBadge: React.CSSProperties = { textAlign: 'right', width: 44, fontWeight: 600 };
const errBox: React.CSSProperties = { fontSize: 12, color: '#c33', border: '1px solid #f0c9c9', background: '#fdf3f3', borderRadius: 6, padding: 12 };

/* ---- preview (the only region styled by --cr-*) ---- */
const preview: React.CSSProperties = {
  background: 'var(--cr-ground)',
  color: 'var(--cr-ink)',
  fontFamily: 'var(--cr-font-ui)',
  fontSize: 'var(--cr-text-body)',
  lineHeight: 'var(--cr-leading-body)',
  borderRadius: 12,
  minHeight: 480,
  padding: 24,
};
const previewInner: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-4)' };
const swatchRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 };
const swatch = (name: string): React.CSSProperties => ({
  background: `var(--cr-${name})`,
  border: '1px solid var(--cr-hairline)',
  borderRadius: 'var(--cr-radius-sm)',
  height: 44,
  display: 'flex',
  alignItems: 'flex-end',
  padding: 4,
});
const swatchName: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--cr-font-mono)', mixBlendMode: 'difference', color: '#fff' };
const sheet: React.CSSProperties = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-hairline)',
  borderRadius: 'var(--cr-radius)',
  padding: 'var(--cr-space-4)',
};
const sheetTitle: React.CSSProperties = {
  fontSize: 'var(--cr-text-caption)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--cr-ink-3)',
  marginBottom: 'var(--cr-space-2)',
};
const sheetBody: React.CSSProperties = { margin: 0, color: 'var(--cr-ink-2)' };
const sheetDim: React.CSSProperties = { margin: '6px 0 0', color: 'var(--cr-ink-3)', fontSize: 'var(--cr-text-small)' };
const controlBase: React.CSSProperties = {
  height: 'var(--cr-control-h)',
  padding: '0 var(--cr-space-3)',
  borderRadius: 'var(--cr-radius-sm)',
  fontSize: 'var(--cr-text-small)',
  fontFamily: 'var(--cr-font-ui)',
  cursor: 'pointer',
  border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...controlBase, background: 'var(--cr-signal)', color: 'var(--cr-accent-ink)' };
const btnSecondary: React.CSSProperties = { ...controlBase, background: 'transparent', color: 'var(--cr-ink)', borderColor: 'var(--cr-hairline)' };
const btnGhost: React.CSSProperties = { ...controlBase, background: 'transparent', color: 'var(--cr-ink-2)' };
const chip: React.CSSProperties = {
  alignSelf: 'center',
  padding: 'var(--cr-chip-pad-y) var(--cr-chip-pad-x)',
  borderRadius: 'var(--cr-radius-sm)',
  background: 'var(--cr-tint)',
  color: 'var(--cr-ink-2)',
  fontSize: 'var(--cr-text-caption)',
};
const triageRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cr-space-2)',
  height: 'var(--cr-row-h)',
  borderBottom: '1px solid var(--cr-hairline)',
  fontSize: 'var(--cr-text-small)',
};
const dot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: 'var(--cr-signal)' };
const rowMono: React.CSSProperties = { fontFamily: 'var(--cr-font-mono)', fontSize: 'var(--cr-text-caption)', color: 'var(--cr-ink-3)' };
