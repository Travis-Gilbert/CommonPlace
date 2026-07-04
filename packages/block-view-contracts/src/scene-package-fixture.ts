import type { ScenePackageV2 } from './scene-package';
import { SCENE_PACKAGE_SCHEMA_VERSION } from './scene-package';

export const SCENE_PACKAGE_V2_FIXTURE: ScenePackageV2 = {
  schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
  version: SCENE_PACKAGE_SCHEMA_VERSION,
  id: 'scene-fixture-1',
  manifestRef: 'manifest:scene-fixture-1',
  atoms: [
    {
      id: 'claim-1',
      kind: 'claim',
      label: 'Scene packages stay declarative',
      position: { x: 0, y: 0, space: 'freeform' },
      weight: 0.95,
      glyph: 'claim',
      lifecycle: 'present',
      metadata: {
        object_type_slug: 'claim',
        body: 'Agents emit intent, clients render trusted components.',
      },
      sourceRefs: [
        {
          kind: 'source',
          id: 'spec-scene-host-acp',
          label: 'SPEC-SCENE-HOST-ACP',
        },
      ],
    },
    {
      id: 'source-1',
      kind: 'source',
      label: 'Spec excerpt',
      lifecycle: 'present',
      metadata: {
        url: 'local:/SPEC-SCENE-HOST-ACP.md',
      },
    },
  ],
  relations: [
    {
      id: 'claim-1-source-1',
      sourceId: 'source-1',
      targetId: 'claim-1',
      kind: 'supports',
      weight: 1,
      lifecycle: 'present',
    },
  ],
  projection: { id: 'evidence_board' },
  chrome: { id: 'commonplace_scene_host' },
  provenance: {
    title: 'Scene Host ACP fixture',
    source: 'SPEC-SCENE-HOST-ACP',
  },
};
