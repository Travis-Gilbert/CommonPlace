// SOURCING: none — pure change-signal derivation over the declared-model
// projection (issue 144 E, the "now" seam).
//
// PR 385 gives the registry versioned projections: every declaration, replace,
// restore or retire mints a `DeclaredSchemaVersion` with a monotonic sequence
// and a content anchor. That is the change signal the ERD canvas needs, and it
// is what makes this seam honest rather than a poll: a read that returns the
// same anchor is a no-op, so the canvas re-renders when the registry actually
// moved and not merely when something was fetched.
//
// theorem-canvas-compile is deliberately not in this path. It compiles semantic
// CanvasDoc and Graph Lisp state and exposes no registry-ERD projection
// consumer, so wiring the canvas to it today would be pretending. The proper
// producer is specified in docs/plans/canvas/SPEC-REGISTRY-ERD-PROJECTION-1.0;
// until it exists this file is the whole contract, and it is small on purpose.

import type { DeclaredModel, SchemaVersion } from '@commonplace/data-model-contracts';

export interface RegistrySignal {
  /** Sequence of the head version. Monotonic per tenant. */
  readonly version: number;
  /** Content anchor of the head version; changes whenever the shape does. */
  readonly contentAnchor: string;
}

export const UNKNOWN_REGISTRY_SIGNAL: RegistrySignal = {
  version: -1,
  contentAnchor: '',
};

function sequenceOf(version: SchemaVersion): number {
  const raw = version.version;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : -1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

/**
 * Head of the version list. The projection marks every version but the last
 * `superseded`, so the head is the one that is `declared`; falling back to the
 * highest sequence keeps this working if that convention ever loosens.
 */
export function registrySignal(declared: DeclaredModel): RegistrySignal {
  const versions = declared.versions ?? [];
  if (versions.length === 0) return UNKNOWN_REGISTRY_SIGNAL;
  let head = versions[versions.length - 1];
  for (const version of versions) {
    if (version.status === 'declared') head = version;
  }
  for (const version of versions) {
    if (sequenceOf(version) > sequenceOf(head)) head = version;
  }
  return {
    version: sequenceOf(head),
    contentAnchor: typeof head.contentAnchor === 'string' ? head.contentAnchor : head.id,
  };
}

/**
 * Whether the registry moved. An unknown signal on either side is treated as
 * "no movement": a read that could not resolve a version must not be allowed
 * to look like a change and drive a render loop.
 */
export function registryMoved(
  previous: RegistrySignal,
  next: RegistrySignal,
): boolean {
  if (next.version < 0 || previous.version < 0) return false;
  return (
    next.version !== previous.version || next.contentAnchor !== previous.contentAnchor
  );
}
