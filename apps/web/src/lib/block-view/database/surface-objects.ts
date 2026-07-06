/** Express a Set as a surface object tree — the "layout is an object" proof.
 *  surface → region → view-instance(descriptor_id: "database"). The view-instance's
 *  query selects the type's rows; its config names the space. Rearranging or
 *  forking a Set is now editing these objects, never the code. */
import type { JsonValue, ObjectRef } from "@/lib/block-view/types";
import type { ObjectGraph } from "./model";

const CONTAINS = "CONTAINS";

export function buildSurfaceObjects(graph: ObjectGraph): ObjectRef[] {
  const surfaceId = graph.space;
  const regionId = `${surfaceId}:region`;
  const instanceId = `${surfaceId}:view`;

  const surface: ObjectRef = {
    id: surfaceId,
    type: "surface",
    properties: { name: graph.set.name, kind: "page" },
    relations: { [CONTAINS]: [regionId] },
  };
  const region: ObjectRef = {
    id: regionId,
    type: "region",
    properties: { layout: "stack" },
    relations: { [CONTAINS]: [instanceId] },
  };
  const viewInstance: ObjectRef = {
    id: instanceId,
    type: "view-instance",
    properties: {
      descriptor_id: "database",
      title: graph.set.name,
      query: { types: [graph.type.key], live: true } as unknown as JsonValue,
      config: { space: graph.space } as unknown as JsonValue,
    },
    relations: {},
  };
  return [surface, region, viewInstance];
}
