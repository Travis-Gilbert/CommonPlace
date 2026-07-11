/**
 * Tests for reconstruction-scene.ts — Item → ScenePackageV2 glue.
 */

import { describe, it, expect } from "vitest";
import { itemToModel3dScenePackage } from "./reconstruction-scene";
import type { ItemGql } from "@/lib/commonplace-graphql";
import { SCENE_PACKAGE_SCHEMA_VERSION } from "@/lib/scene-package";

function makeItem(overrides: Partial<ItemGql> = {}): ItemGql {
  return {
    id: "item-abc",
    kind: "Scene",
    title: "Reconstructed glTF — teapot",
    bodyText: "https://example.com/model.glb",
    blobHash: null,
    mime: null,
    source: null,
    residency: "local",
    tags: ["reconstructed", "procedural", "oracle"],
    collections: [],
    classification: "procedural",
    status: null,
    priority: null,
    dueAtMs: null,
    path: null,
    extra: { modality: "procedural", confidence_mean: 0.88, gltf_url: "https://example.com/model.glb" },
    createdAtMs: 1000,
    updatedAtMs: 2000,
    ...overrides,
  };
}

describe("itemToModel3dScenePackage", () => {
  it("returns null when item is not tagged reconstructed", () => {
    const item = makeItem({ tags: ["other"] });
    expect(itemToModel3dScenePackage(item)).toBeNull();
  });

  it("returns null when no glTF URL can be resolved", () => {
    const item = makeItem({
      bodyText: null,
      extra: { modality: "procedural" },
    });
    expect(itemToModel3dScenePackage(item)).toBeNull();
  });

  it("resolves glTF from extra.gltf_url", () => {
    const scene = itemToModel3dScenePackage(
      makeItem({
        extra: {
          modality: "procedural",
          confidence_mean: 0.88,
          gltf_url: "https://cdn.example.com/teapot.glb",
        },
      }),
    );
    expect(scene).not.toBeNull();
    expect(scene!.projection.id).toBe("model_3d");
    expect(scene!.atoms[0].metadata?.gltf_url).toBe(
      "https://cdn.example.com/teapot.glb",
    );
    expect(scene!.atoms[0].metadata?.confidence_mean).toBe(0.88);
    expect(scene!.atoms[0].metadata?.modality).toBe("procedural");
  });

  it("resolves glTF from bodyText when it ends in .glb", () => {
    const scene = itemToModel3dScenePackage(
      makeItem({
        bodyText: "https://cdn.example.com/mesh.glb",
        extra: { modality: "procedural" },
      }),
    );
    expect(scene).not.toBeNull();
    expect(scene!.atoms[0].metadata?.gltf_url).toBe(
      "https://cdn.example.com/mesh.glb",
    );
  });

  it("resolves glTF from bodyText JSON with gltf_url key", () => {
    const scene = itemToModel3dScenePackage(
      makeItem({
        bodyText: JSON.stringify({
          gltf_url: "https://cdn.example.com/from-json.gltf",
          other: "stuff",
        }),
        extra: { modality: "procedural" },
      }),
    );
    expect(scene).not.toBeNull();
    expect(scene!.atoms[0].metadata?.gltf_url).toBe(
      "https://cdn.example.com/from-json.gltf",
    );
  });

  it("honors schema_version", () => {
    const scene = itemToModel3dScenePackage(makeItem());
    expect(scene!.schema_version).toBe(SCENE_PACKAGE_SCHEMA_VERSION);
    expect(scene!.version).toBe(SCENE_PACKAGE_SCHEMA_VERSION);
  });

  it("includes provenance with confidence label", () => {
    const scene = itemToModel3dScenePackage(makeItem());
    expect(scene!.provenance?.confidence).toBe("88% confident");
    expect(scene!.provenance?.item_id).toBe("item-abc");
  });

  it("sets lifecycle to present", () => {
    const scene = itemToModel3dScenePackage(makeItem());
    expect(scene!.atoms[0].lifecycle).toBe("present");
  });

  it("carries sourceRef pointing back to the original item", () => {
    const scene = itemToModel3dScenePackage(makeItem());
    expect(scene!.atoms[0].sourceRefs).toEqual([
      { kind: "item", id: "item-abc", label: "Reconstructed glTF — teapot" },
    ]);
  });

  it("resolves .gltf extension from bodyText", () => {
    const scene = itemToModel3dScenePackage(
      makeItem({
        bodyText: "https://cdn.example.com/scene.gltf?version=2",
        extra: { modality: "procedural" },
      }),
    );
    expect(scene).not.toBeNull();
    expect(scene!.atoms[0].metadata?.gltf_url).toBe(
      "https://cdn.example.com/scene.gltf?version=2",
    );
  });
});
