/**
 * Convert a reconstructed CommonPlace Item into a ScenePackageV2 for
 * the model_3d renderer.
 *
 * The reconstructor's procedural output is a glTF URL or blob hash
 * stored on the Item. This utility lifts that into a ScenePackageV2
 * so SceneHost can route it to Model3dRenderer.
 */

import {
  SCENE_PACKAGE_SCHEMA_VERSION,
  type ScenePackageV2,
} from '@/lib/scene-package';
import { RECONSTRUCTED_TAG, parseReconstructedExtra } from './reconstruction-types';
import type { ItemGql } from '@/lib/commonplace-graphql';

/**
 * Build a model_3d ScenePackageV2 from a reconstructed Item whose
 * `bodyText` carries a glTF URL.
 *
 * Returns null when the item doesn't look like a procedural reconstructed fact
 * or doesn't carry a glTF URL.
 */
export function itemToModel3dScenePackage(item: ItemGql): ScenePackageV2 | null {
  // Gate: must be tagged "reconstructed"
  if (!item.tags.includes(RECONSTRUCTED_TAG)) return null;

  const extra = parseReconstructedExtra(item.extra);
  // ponytail: accept any modality since a procedural fact could arrive
  // via binary (decompiled to mesh), design (reconstructed 3d asset), etc.

  const gltfUrl = resolveGltfUrl(item);
  if (!gltfUrl) return null;

  const title = item.title || `Reconstructed 3D model — ${item.id}`;
  const confidenceLabel =
    extra?.confidence_mean != null
      ? `${(extra.confidence_mean * 100).toFixed(0)}% confident`
      : null;

  return {
    schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
    version: SCENE_PACKAGE_SCHEMA_VERSION,
    id: `scene-${item.id}`,
    manifestRef: `item:${item.id}`,
    atoms: [
      {
        id: `model-${item.id}`,
        kind: 'model_3d',
        label: title,
        lifecycle: 'present',
        metadata: {
          gltf_url: gltfUrl,
          confidence_mean: extra?.confidence_mean,
          fact_type: extra?.fact_type,
          modality: extra?.modality,
        },
        sourceRefs: [
          {
            kind: 'item',
            id: item.id,
            label: item.title,
          },
        ],
      },
    ],
    relations: [],
    projection: { id: 'model_3d' },
    chrome: { id: 'commonplace_scene_host' },
    provenance: {
      title,
      item_id: item.id,
      modality: extra?.modality,
      confidence: confidenceLabel,
    },
  };
}

/**
 * Extract a public glTF URL from a reconstructed Item.
 *
 * Checks in order:
 * 1. `item.extra.gltf_url` — the reconstructor stamped it directly
 * 2. `item.bodyText` — looks like a URL ending in .gltf or .glb
 * 3. `item.bodyText` — is a JSON string with a gltf_url key
 */
function resolveGltfUrl(item: ItemGql): string | null {
  const extra = item.extra as Record<string, unknown> | undefined;

  // 1. Direct extra stamp
  if (typeof extra?.gltf_url === 'string' && extra.gltf_url) {
    return extra.gltf_url;
  }

  // 2. bodyText is a URL
  if (
    item.bodyText &&
    /^https?:\/\/.+\.(gltf|glb)(\?.*)?$/i.test(item.bodyText.trim())
  ) {
    return item.bodyText.trim();
  }

  // 3. bodyText is JSON with gltf_url
  if (item.bodyText) {
    try {
      const parsed = JSON.parse(item.bodyText);
      if (typeof parsed?.gltf_url === 'string' && parsed.gltf_url) {
        return parsed.gltf_url;
      }
    } catch {
      // not JSON, ignore
    }
  }

  return null;
}
