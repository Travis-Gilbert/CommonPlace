import {
  SCENE_PACKAGE_SCHEMA_VERSION,
  type SceneAtom,
  type ScenePackageV2,
} from '@/lib/scene-package';
import type { ReconstructionRunGql } from '@/lib/commonplace-graphql';

export type ReconstructionProvenance = 'Captured' | 'Generated' | 'Asserted';

export const RECONSTRUCTION_PROVENANCE: ReconstructionProvenance[] = [
  'Captured',
  'Generated',
  'Asserted',
];

export function provenanceClass(value: unknown): ReconstructionProvenance {
  const kind = recordOf(value).kind;
  switch (kind) {
    case 'captured':
      return 'Captured';
    case 'asserted':
      return 'Asserted';
    default:
      return 'Generated';
  }
}

export function hasMixedProvenance(run: ReconstructionRunGql): boolean {
  return new Set(run.atoms.map((atom) => provenanceClass(atom.provenance))).size > 1;
}

export function scenePackageForReconstruction(
  run: ReconstructionRunGql,
  visibleProvenance: ReadonlySet<ReconstructionProvenance>,
): ScenePackageV2 {
  return {
    schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
    version: SCENE_PACKAGE_SCHEMA_VERSION,
    id: `reconstruction:${run.id}`,
    manifestRef: run.id,
    atoms: run.atoms.map((atom) => sceneAtomForReconstruction(atom, visibleProvenance)),
    relations: [],
    projection: { id: 'evidence_board' },
    chrome: { id: 'commonplace_scene_host' },
    provenance: {
      title: `Reconstruction ${run.subjectId || run.id}`,
      reconstruction_run_id: run.id,
      domain: run.domain,
    },
  };
}

function sceneAtomForReconstruction(
  atom: ReconstructionRunGql['atoms'][number],
  visibleProvenance: ReadonlySet<ReconstructionProvenance>,
): SceneAtom {
  const payload = recordOf(atom.payload);
  const provenance = provenanceClass(atom.provenance);
  const metadata = recordOf(payload.metadata);
  return {
    id: (stringValue(payload.id) ?? atom.atomId) || atom.id,
    kind: stringValue(payload.kind) ?? 'reconstruction-atom',
    label: (stringValue(payload.label) ?? atom.atomId) || atom.id,
    lifecycle: lifecycleValue(payload.lifecycle),
    weight: numberValue(payload.weight),
    color: stringValue(payload.color),
    opacity: visibleProvenance.has(provenance) ? numberValue(payload.opacity) ?? 1 : 0.18,
    glyph: stringValue(payload.glyph),
    scale: numberValue(payload.scale),
    metadata: {
      ...metadata,
      reconstructionProvenance: atom.provenance,
    },
    sourceRefs: [
      {
        id: atom.id,
        kind: provenance,
        label: stringValue(payload.label),
        metadata: { reconstructionProvenance: atom.provenance },
      },
    ],
  };
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function lifecycleValue(value: unknown): SceneAtom['lifecycle'] {
  return value === 'entering' || value === 'leaving' || value === 'terminal' ? value : 'present';
}
