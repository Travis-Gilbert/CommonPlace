import { describe, expect, it } from 'vitest';
import {
  SCENE_PACKAGE_V2_FIXTURE,
  validateScenePackage,
  type ScenePackageV2,
} from '@/lib/scene-package';

describe('ScenePackageV2 shared validation', () => {
  it('accepts the shared fixture without dropping fields', () => {
    const copy = JSON.parse(JSON.stringify(SCENE_PACKAGE_V2_FIXTURE)) as ScenePackageV2;
    expect(validateScenePackage(copy)).toEqual({ ok: true });
    expect(copy.schema_version).toBe('scene-package-v2');
    expect(copy.manifestRef).toBe('manifest:scene-fixture-1');
    expect(copy.atoms[0]?.sourceRefs?.[0]?.label).toBe('SPEC-SCENE-HOST-ACP');
  });

  it('matches the Rust unknown renderer reason string', () => {
    const scenePackage: ScenePackageV2 = {
      ...SCENE_PACKAGE_V2_FIXTURE,
      projection: { id: 'not_a_renderer' },
    };
    expect(validateScenePackage(scenePackage)).toEqual({
      ok: false,
      reason: 'unknown renderer: not_a_renderer',
    });
  });

  it('matches the Rust over-budget reason string', () => {
    const scenePackage: ScenePackageV2 = {
      ...SCENE_PACKAGE_V2_FIXTURE,
      atoms: Array.from({ length: 201 }, (_, index) => ({
        id: `atom-${index}`,
        kind: 'claim',
        lifecycle: 'present',
      })),
      relations: [],
    };
    expect(validateScenePackage(scenePackage)).toEqual({
      ok: false,
      reason: 'renderer evidence_board budget exceeded: atoms 201 > 200',
    });
  });
});
