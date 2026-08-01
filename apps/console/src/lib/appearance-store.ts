'use client';

// SOURCING: React useSyncExternalStore. The appearance preference is a small
// browser external store because system-color changes can happen without a
// React event, and the same snapshot must drive controls, root attributes,
// and persistence.
//
// Derived coloration (the Navy family and its OKLCH knobs) is retired
// (2026-08-01). It painted generated values onto documentElement as inline
// styles, which outrank every stylesheet rule, so a stored derived theme
// permanently overrode --ij-frame and the whole --ij-gray ramp and made the
// pinned registers unreachable. The store now selects between pinned
// registers only, and never writes inline paint. theme-engine.ts survives as
// a pure module because the contrast gate exercises its clamping against
// adversarial inputs; nothing at runtime calls it.

import { useSyncExternalStore } from 'react';
import { GENERATED_THEME_VARIABLES, type ResolvedThemeMode } from '@/styles/theme-engine';

export type ThemeMode = 'auto' | ResolvedThemeMode;
export type ThemeFamily = 'intellij' | 'github';
export type AppearancePresetId = 'intellij-dark' | 'intellij-light' | 'github-dark' | 'github-light';
export type AppearanceDensity = 'comfortable' | 'compact';

export interface AppearancePreference {
  readonly mode: ThemeMode;
  readonly family: ThemeFamily;
  readonly density: AppearanceDensity;
}

export interface AppearanceSnapshot {
  readonly preference: AppearancePreference;
  readonly resolvedMode: ResolvedThemeMode;
  readonly presetId: AppearancePresetId;
}

export type AppearancePresetSource = { readonly kind: 'pinned'; readonly register: 'intellij' | 'github' };

export const APPEARANCE_STORAGE_KEY = 'commonplace.console.appearance.v1';

export const APPEARANCE_PRESETS: readonly {
  id: AppearancePresetId;
  label: string;
  family: ThemeFamily;
  mode: ResolvedThemeMode;
  source: AppearancePresetSource;
}[] = [
  { id: 'intellij-dark', label: 'IntelliJ Dark', family: 'intellij', mode: 'dark', source: { kind: 'pinned', register: 'intellij' } },
  { id: 'intellij-light', label: 'IntelliJ Light', family: 'intellij', mode: 'light', source: { kind: 'pinned', register: 'intellij' } },
  { id: 'github-dark', label: 'GitHub Dark', family: 'github', mode: 'dark', source: { kind: 'pinned', register: 'github' } },
  { id: 'github-light', label: 'GitHub Light', family: 'github', mode: 'light', source: { kind: 'pinned', register: 'github' } },
];

const defaultPreference: AppearancePreference = {
  mode: 'auto',
  family: 'intellij',
  density: 'comfortable',
};

let snapshot: AppearanceSnapshot = {
  preference: defaultPreference,
  resolvedMode: 'dark',
  presetId: 'intellij-dark',
};
let started = false;
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

function resolvedMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode !== 'auto') return mode;
  return media?.matches ? 'dark' : 'light';
}

function presetId(preference: AppearancePreference, mode: ResolvedThemeMode): AppearancePresetId {
  return `${preference.family}-${mode}`;
}

function validPreference(value: unknown): AppearancePreference | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppearancePreference>;
  if (!['auto', 'dark', 'light'].includes(String(candidate.mode))) return null;
  // A stored 'navy' or 'paper' family fails here and falls back to the
  // default, which is the migration off derived coloration.
  if (!['intellij', 'github'].includes(String(candidate.family))) return null;
  const density =
    candidate.density === 'compact' || candidate.density === 'comfortable'
      ? candidate.density
      : 'comfortable';
  return { mode: candidate.mode as ThemeMode, family: candidate.family as ThemeFamily, density };
}

function readPreference(): AppearancePreference {
  try {
    // persistence-preference: key=commonplace.console.appearance.v1; preference=appearance; reason=restores the chosen theme and density before hydration
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return defaultPreference;
    const parsed = JSON.parse(raw) as { preference?: unknown };
    return validPreference(parsed.preference) ?? defaultPreference;
  } catch {
    return defaultPreference;
  }
}

function writeSnapshot(next: AppearanceSnapshot): void {
  try {
    // persistence-preference: key=commonplace.console.appearance.v1; preference=appearance; reason=persists the chosen theme and density preference snapshot
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        preference: next.preference,
        resolvedMode: next.resolvedMode,
        presetId: next.presetId,
      }),
    );
  } catch {
    // Storage can be unavailable in privacy modes; the live theme still works.
  }
}

function paint(next: AppearanceSnapshot): void {
  const root = document.documentElement;
  root.dataset.theme = next.resolvedMode;
  root.dataset.themeMode = next.preference.mode;
  root.dataset.themeFamily = next.preference.family;
  root.dataset.themePreset = next.presetId;
  root.dataset.themeDerived = 'false';
  root.dataset.density = next.preference.density;
  // Sweep any inline paint left by a derived theme in this document. Inline
  // styles do not survive a reload, so this only matters within a session
  // that started before the retirement; it costs nothing and guarantees the
  // register is the only source of color.
  for (const name of GENERATED_THEME_VARIABLES) root.style.removeProperty(name);
}

function commit(preference: AppearancePreference): void {
  const mode = resolvedMode(preference.mode);
  const next: AppearanceSnapshot = {
    preference,
    resolvedMode: mode,
    presetId: presetId(preference, mode),
  };
  snapshot = next;
  paint(next);
  writeSnapshot(next);
  listeners.forEach((listener) => listener());
}

export function startAppearanceStore(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!started) {
    started = true;
    media = window.matchMedia('(prefers-color-scheme: dark)');
    commit(readPreference());
    media.addEventListener('change', onSystemThemeChange);
  }
  return () => {};
}

function onSystemThemeChange(): void {
  if (snapshot.preference.mode === 'auto') commit(snapshot.preference);
}

export function setAppearancePreference(patch: Partial<AppearancePreference>): void {
  commit({ ...snapshot.preference, ...patch });
}

export function selectAppearancePreset(id: AppearancePresetId): void {
  const preset = APPEARANCE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return;
  commit({
    ...snapshot.preference,
    family: preset.family,
    mode: preset.mode,
  });
}

export function getAppearanceSnapshot(): AppearanceSnapshot {
  return snapshot;
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance(): AppearanceSnapshot {
  return useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceSnapshot);
}
