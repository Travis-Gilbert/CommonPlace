/**
 * CR1 — the register mapped onto the block-view ThemeTokens contract.
 *
 * console-register.css declares the `--cr-*` custom properties; this is the same
 * register expressed as the `ThemeTokens` a BlockHost hands its ViewDescriptors,
 * so an object rendered inline (an Operator bay, the CR5 Index stream, a chat
 * tool card per WORK-SURFACE) inherits the identical computed system as the
 * shell without importing a stylesheet. One register, two delivery channels:
 * CSS custom properties for the shell, this object for object renderers.
 *
 * Every value is a `var(--cr-*)` reference — no literal lives here, so changing
 * an axis and regenerating the register restyles renderers with zero edits to
 * this file.
 */

import type { ThemeTokens } from './types';

export const CONSOLE_THEME_TOKENS: ThemeTokens = {
  color: {
    // Canonical register roles.
    ground: 'var(--cr-ground)',
    surface: 'var(--cr-surface)',
    top: 'var(--cr-top)',
    ink: 'var(--cr-ink)',
    ink2: 'var(--cr-ink-2)',
    ink3: 'var(--cr-ink-3)',
    hairline: 'var(--cr-hairline)',
    signal: 'var(--cr-signal)',
    signalPressed: 'var(--cr-signal-pressed)',
    link: 'var(--cr-link)',
    accentInk: 'var(--cr-accent-ink)',
    tint: 'var(--cr-tint)',
    // Backward-compatible aliases so hosts migrating off porcelain keep working
    // (accent maps to the register signal — both oxblood).
    accent: 'var(--cr-signal)',
  },
  space: {
    unit: 'var(--cr-space-unit)',
    '1': 'var(--cr-space-1)',
    '2': 'var(--cr-space-2)',
    '3': 'var(--cr-space-3)',
    '4': 'var(--cr-space-4)',
    '5': 'var(--cr-space-5)',
    '6': 'var(--cr-space-6)',
    // Legacy alias.
    u: 'var(--cr-space-2)',
  },
  typography: {
    ui: 'var(--cr-font-ui)',
    mono: 'var(--cr-font-mono)',
    prose: 'var(--cr-font-prose)',
    body: 'var(--cr-text-body)',
    small: 'var(--cr-text-small)',
    caption: 'var(--cr-text-caption)',
    // The single chrome title scale (CR3 decision 7: titles at h4).
    title: 'var(--cr-text-h4)',
    leadingBody: 'var(--cr-leading-body)',
    // Legacy aliases (porcelain used display/body faces).
    display: 'var(--cr-font-ui)',
  },
  radius: {
    sm: 'var(--cr-radius-sm)',
    base: 'var(--cr-radius)',
    lg: 'var(--cr-radius-lg)',
    // Legacy alias.
    band: 'var(--cr-radius)',
  },
  raw: {
    controlH: 'var(--cr-control-h)',
    rowH: 'var(--cr-row-h)',
    chipPadX: 'var(--cr-chip-pad-x)',
    chipPadY: 'var(--cr-chip-pad-y)',
    borderWidth: 'var(--cr-border-width)',
    motion: 'var(--cr-motion)',
    ease: 'var(--cr-ease)',
    shadowTransient: 'var(--cr-shadow-transient)',
  },
};
