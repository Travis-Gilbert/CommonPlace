'use client';

// SOURCING: React useSyncExternalStore. The appearance preference is a small
// browser external store because system-color changes can happen without a
// React event, and the same snapshot must drive controls, root attributes,
// persistence, and the contrast note.

import { useSyncExternalStore } from 'react';
import {
  GENERATED_THEME_VARIABLES,
  NAVY_KNOBS,
  generateTheme,
  type GeneratedTheme,
  type ResolvedThemeMode,
  type ThemeKnobs,
} from '@/styles/theme-engine';

export type ThemeMode = 'auto' | ResolvedThemeMode;
export type ThemeFamily = 'intellij' | 'github' | 'navy';
export type AppearancePresetId = 'intellij-dark' | 'intellij-light' | 'github-dark' | 'github-light' | 'navy';
export type AppearanceDensity = 'comfortable' | 'compact';

export interface AppearancePreference {
  readonly mode: ThemeMode;
  readonly family: ThemeFamily;
  readonly knobs: ThemeKnobs;
  readonly density: AppearanceDensity;
}

export interface AppearanceSnapshot {
  readonly preference: AppearancePreference;
  readonly resolvedMode: ResolvedThemeMode;
  readonly presetId: AppearancePresetId;
  readonly generated: GeneratedTheme | null;
}

export type AppearancePresetSource =
  | { readonly kind: 'pinned'; readonly register: 'intellij' | 'github' }
  | { readonly kind: 'knobs'; readonly knobs: ThemeKnobs };

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
  { id: 'navy', label: 'Navy', family: 'navy', mode: 'dark', source: { kind: 'knobs', knobs: NAVY_KNOBS } },
];

const defaultPreference: AppearancePreference = {
  mode: 'auto',
  family: 'intellij',
  knobs: NAVY_KNOBS,
  density: 'comfortable',
};

let snapshot: AppearanceSnapshot = {
  preference: defaultPreference,
  resolvedMode: 'dark',
  presetId: 'intellij-dark',
  generated: null,
};
let started = false;
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

function resolvedMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode !== 'auto') return mode;
  return media?.matches ? 'dark' : 'light';
}

function presetId(preference: AppearancePreference, mode: ResolvedThemeMode): AppearancePresetId {
  return preference.family === 'navy' ? 'navy' : `${preference.family}-${mode}`;
}

function validPreference(value: unknown): AppearancePreference | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppearancePreference>;
  if (!['auto', 'dark', 'light'].includes(String(candidate.mode))) return null;
  if (!['intellij', 'github', 'navy'].includes(String(candidate.family))) return null;
  const knobs = candidate.knobs as Partial<ThemeKnobs> | undefined;
  if (!knobs || ![knobs.tintHue, knobs.tintChroma, knobs.highlightHue].every((item) => typeof item === 'number')) return null;
  const density =
    candidate.density === 'compact' || candidate.density === 'comfortable'
      ? candidate.density
      : 'comfortable';
  return { ...(candidate as AppearancePreference), density };
}

function readPreference(): AppearancePreference {
  try {
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
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        preference: next.preference,
        resolvedMode: next.resolvedMode,
        presetId: next.presetId,
        variables: next.generated?.variables ?? {},
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
  root.dataset.themeDerived = next.generated ? 'true' : 'false';
  root.dataset.density = next.preference.density;
  for (const name of GENERATED_THEME_VARIABLES) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(next.generated?.variables ?? {})) {
    root.style.setProperty(name, value);
  }
}

function commit(preference: AppearancePreference): void {
  const mode = resolvedMode(preference.mode);
  const next: AppearanceSnapshot = {
    preference,
    resolvedMode: mode,
    presetId: presetId(preference, mode),
    generated: preference.family === 'navy' ? generateTheme(mode, preference.knobs) : null,
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
  const preference = {
    ...snapshot.preference,
    ...patch,
    knobs: patch.knobs ?? snapshot.preference.knobs,
  };
  commit(preference);
}

export function setAppearanceKnobs(patch: Partial<ThemeKnobs>): void {
  setAppearancePreference({
    family: 'navy',
    knobs: { ...snapshot.preference.knobs, ...patch },
  });
}

export function selectAppearancePreset(id: AppearancePresetId): void {
  const preset = APPEARANCE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return;
  commit({
    ...snapshot.preference,
    family: preset.family,
    mode: preset.mode,
    knobs: preset.source.kind === 'knobs' ? preset.source.knobs : snapshot.preference.knobs,
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
