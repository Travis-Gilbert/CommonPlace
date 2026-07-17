'use client';

// SOURCING: none. Pure logic, no upstream component applies.
// The tool window registration mechanism (G3): registerToolWindow binds a
// chrome-level identity (icon, side, shortcut) to a surface region id. The
// window's CONTENT still comes from the region's view instances resolved by
// descriptor; this registry only supplies the stripe affordance.

import type { ComponentType, SVGProps } from 'react';

export interface ToolWindowRegistration {
  /** Matches the surface region object id that hosts this window's views. */
  readonly id: string;
  readonly title: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  readonly side: 'left' | 'right';
  /** Display form of the toggle shortcut, e.g. "Alt+1". */
  readonly shortcut: string;
  /** KeyboardEvent.key the shortcut binds under Alt. */
  readonly key: string;
}

const registrations = new Map<string, ToolWindowRegistration>();

export function registerToolWindow(registration: ToolWindowRegistration): void {
  registrations.set(registration.id, registration);
}

export function toolWindowsFor(side: 'left' | 'right'): ToolWindowRegistration[] {
  return [...registrations.values()].filter((registration) => registration.side === side);
}

export function toolWindowById(id: string): ToolWindowRegistration | undefined {
  return registrations.get(id);
}

export function allToolWindows(): ToolWindowRegistration[] {
  return [...registrations.values()];
}
