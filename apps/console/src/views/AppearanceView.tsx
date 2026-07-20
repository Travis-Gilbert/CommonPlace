'use client';

// SOURCING: hand-roll over the shared appearance external store. This is a
// registered workspace view, not a settings page, so it exercises the same
// surface/descriptor contract as records, documents, code, and thread.

import { useEffect } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  APPEARANCE_PRESETS,
  selectAppearancePreset,
  setAppearanceKnobs,
  setAppearancePreference,
  startAppearanceStore,
  useAppearance,
  type AppearanceDensity,
  type ThemeMode,
} from '@/lib/appearance-store';
import { IconMemory } from '@/components/shell/icons';

const MODES: readonly { id: ThemeMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

const DENSITIES: readonly { id: AppearanceDensity; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}) {
  return (
    <label className="grid gap-2 text-ij-ink">
      <span className="flex items-baseline justify-between gap-3">
        {label}
        <output className="font-ij-mono text-ij-ink-info">{value.toFixed(step < 1 ? 3 : 0)}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ accentColor: 'var(--ij-accent)' }}
      />
    </label>
  );
}

export function AppearanceView(_props: ViewRenderProps) {
  const appearance = useAppearance();
  const { preference, generated } = appearance;

  useEffect(() => startAppearanceStore(), []);

  return (
    <div data-appearance-view className="h-full overflow-y-auto bg-ij-editor text-ij-ink">
      <div className="mx-auto grid max-w-5xl gap-6 p-6">
        <header className="grid gap-1">
          <h1 className="text-xl" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Appearance</h1>
          <p className="text-ij-ink-info">Color the whole register without changing the console&rsquo;s IntelliJ geometry.</p>
        </header>

        <section className="grid gap-3" aria-labelledby="appearance-mode-heading">
          <h2 id="appearance-mode-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Mode</h2>
          <div className="flex w-fit gap-1 rounded-ij-arc border border-ij-control-border bg-ij-chrome p-1">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={preference.mode === mode.id}
                onClick={() => setAppearancePreference({ mode: mode.id })}
                className="h-ij-control rounded-ij-arc-underline px-4 text-ij-ink-info aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="text-ij-ink-info">Resolved to {appearance.resolvedMode}; Auto follows the operating system live.</p>
        </section>

        <section className="grid gap-3" aria-labelledby="appearance-density-heading">
          <h2 id="appearance-density-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Density</h2>
          <div className="flex w-fit gap-1 rounded-ij-arc border border-ij-control-border bg-ij-chrome p-1">
            {DENSITIES.map((density) => (
              <button
                key={density.id}
                type="button"
                data-appearance-density={density.id}
                aria-pressed={preference.density === density.id}
                onClick={() => setAppearancePreference({ density: density.id })}
                className="h-ij-control rounded-ij-arc-underline px-4 text-ij-ink-info aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
              >
                {density.label}
              </button>
            ))}
          </div>
          <p className="text-ij-ink-info">Compact shortens toolbars, headers, and gutters the way JetBrains Compact Mode does.</p>
        </section>

        <section className="grid gap-3" aria-labelledby="appearance-presets-heading">
          <h2 id="appearance-presets-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Presets</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {APPEARANCE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-appearance-preset={preset.id}
                aria-pressed={appearance.presetId === preset.id}
                onClick={() => selectAppearancePreset(preset.id)}
                className="min-h-ij-toolbar rounded-ij-arc border border-ij-control-border bg-ij-chrome px-3 text-left text-ij-ink hover:bg-ij-hover-surface aria-pressed:border-ij-accent aria-pressed:bg-ij-selection"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-4" aria-labelledby="appearance-derived-heading">
          <div>
            <h2 id="appearance-derived-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Derived coloration</h2>
            <p className="text-ij-ink-info">Moving a control selects Navy and re-anchors the neutral ladder in OKLCH.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-4 rounded-ij-arc bg-ij-editor p-4">
              <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Background tint</h3>
              <Slider label="Tint hue" value={preference.knobs.tintHue} min={0} max={360} step={1} onChange={(tintHue) => setAppearanceKnobs({ tintHue })} />
              <Slider label="Tint chroma" value={preference.knobs.tintChroma} min={0} max={0.04} step={0.001} onChange={(tintChroma) => setAppearanceKnobs({ tintChroma })} />
            </div>
            <div className="grid gap-4 rounded-ij-arc bg-ij-editor p-4">
              <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Highlight</h3>
              <Slider label="Highlight hue" value={preference.knobs.highlightHue} min={0} max={360} step={1} onChange={(highlightHue) => setAppearanceKnobs({ highlightHue })} />
              <div className="rounded-ij-arc bg-ij-selection p-3 text-ij-ink">Selected text stays readable while the hue moves.</div>
            </div>
          </div>
          <div aria-live="polite" className="min-h-ij-row text-ij-ink-info">
            {generated?.clampNotes.length
              ? generated.clampNotes.join(' ')
              : 'No contrast clamps are active.'}
          </div>
        </section>

        <section className="grid gap-3" aria-labelledby="appearance-preview-heading">
          <h2 id="appearance-preview-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Live preview</h2>
          <div className="overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-frame p-1">
            <div className="grid gap-px bg-ij-seam md:grid-cols-2">
              <div className="bg-ij-chrome p-4">
                <div className="mb-3 flex items-center gap-2 text-ij-memory"><IconMemory domain="memory" size={16} /> Memory</div>
                <div className="rounded-ij-arc bg-ij-selection p-2 text-ij-ink">Active record</div>
                <div className="mt-1 p-2 text-ij-ink-info">Secondary apparatus</div>
              </div>
              <div className="bg-ij-editor p-4">
                <div className="font-ij-mono text-ij-ink"><span className="text-ij-warn">const</span> coloration = <span className="text-ij-ok">&apos;register-wide&apos;</span>;</div>
                <div className="mt-4 h-ij-control rounded-ij-arc bg-ij-search-match px-3 leading-7 text-ij-ink">Search match</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
