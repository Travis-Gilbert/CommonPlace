import { describe, expect, it } from 'vitest';
import type { ReconstructionRunGql } from '@/lib/commonplace-graphql';
import {
  hasMixedProvenance,
  provenanceClass,
  scenePackageForReconstruction,
} from '../reconstruction-viewer';

const run: ReconstructionRunGql = {
  id: 'recon:fixture:run:1',
  domain: 'concept',
  subjectId: 'concept-1',
  stageReceipts: [],
  atoms: [
    {
      id: 'atom:captured',
      atomId: 'captured',
      provenance: { kind: 'captured', source: 'golden:1' },
      payload: { id: 'captured', kind: 'ConceptEntity', label: 'Resolved entity', lifecycle: 'present' },
    },
    {
      id: 'atom:generated',
      atomId: 'generated',
      provenance: { kind: 'generated', prior: 'retrieval-prior/v1', basis: {} },
      payload: { id: 'generated', kind: 'ConceptClaim', label: 'Generated claim', lifecycle: 'present' },
    },
    {
      id: 'atom:asserted',
      atomId: 'asserted',
      provenance: { kind: 'asserted', source: 'operator:1' },
      payload: { id: 'asserted', kind: 'Assertion', label: 'Asserted claim', lifecycle: 'present' },
    },
  ],
};

describe('reconstruction viewer projection', () => {
  it('classifies the mandatory atom provenance enum', () => {
    expect(provenanceClass(run.atoms[0].provenance)).toBe('Captured');
    expect(provenanceClass(run.atoms[1].provenance)).toBe('Generated');
    expect(provenanceClass(run.atoms[2].provenance)).toBe('Asserted');
  });

  it('shows provenance controls only when the run mixes provenance classes', () => {
    expect(hasMixedProvenance(run)).toBe(true);
    expect(hasMixedProvenance({ ...run, atoms: [run.atoms[1]] })).toBe(false);
  });

  it('builds a ScenePackageV2 and dims disabled provenance without removing atoms', () => {
    const scene = scenePackageForReconstruction(run, new Set(['Generated', 'Asserted']));

    expect(scene.id).toBe('reconstruction:recon:fixture:run:1');
    expect(scene.atoms).toHaveLength(3);
    expect(scene.atoms.find((atom) => atom.id === 'captured')?.opacity).toBe(0.18);
    expect(scene.atoms.find((atom) => atom.id === 'generated')?.opacity).toBe(1);
    expect(scene.atoms.find((atom) => atom.id === 'asserted')?.sourceRefs?.[0]?.kind).toBe('Asserted');
  });
});
