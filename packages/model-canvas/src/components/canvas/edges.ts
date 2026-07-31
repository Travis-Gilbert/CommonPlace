// SOURCING: @xyflow/react Edge shape; relation edges now carry
// @commonplace/canvas-substrate SubstrateEdgeData with the model palette, so
// both canvases share one geometry and dash system (issue 144 B).

import type { Edge } from "@xyflow/react";
import type { SubstrateEdgeData } from "@commonplace/canvas-substrate";
import type { ModelNode, ModelEdge } from "@commonplace/okf";
import type { ViewMode } from "../../state/viewMode";
import { visibleKeys, showCardinality, type RelLabelMode } from "../../state/relLabels";
import { erdAwareNodeSize } from "./layoutSize";

type Side = "left" | "right";

/**
 * Project a relation onto the substrate edge contract. The model palette stays
 * neutral ink on purpose: a relation is not a typed flow, so the information
 * rides the key chip and the cardinality glyph rather than a hue.
 */
function relationEdgeData(
  e: ModelEdge,
  keys: ModelEdge["keys"],
  relLabelMode: RelLabelMode,
): SubstrateEdgeData & { modelEdgeId: string } {
  const shown = visibleKeys(keys, relLabelMode);
  const label = shown.length > 0
    ? shown.map(k => `${k.left || "?"} = ${k.right || "?"}`).join(", ")
    : undefined;
  return {
    palette: "model",
    ...(label ? { label } : {}),
    ...(e.cardinality && showCardinality(keys, relLabelMode)
      ? { cardinality: e.cardinality }
      : {}),
    arrow: e.bidirectional ? "both" : "end",
    modelEdgeId: e.id,
  };
}

// Pick the horizontal side each end of an edge attaches to.
//
// A handle the user explicitly chose (stored on the edge from a manual drag)
// always wins, so their choice is preserved. Otherwise the side is derived from
// the nodes' relative position: each end exits *toward* the other node -- the
// shortest route, no loop-around. The SAME rule runs in compact and ERD mode, so
// the side never jumps when toggling views (imported/template edges carry no
// stored handle, which is exactly the case that used to disagree between modes).
// A hub's edges naturally split across both sides because each one faces its own
// neighbour.
function edgeSides(
  src: ModelNode | undefined,
  tgt: ModelNode | undefined,
  e: ModelEdge,
  viewMode: ViewMode,
): { source: Side; target: Side } {
  let source: Side = "right";
  let target: Side = "left";
  if (src && tgt) {
    const sx = src.position.x + erdAwareNodeSize(src, viewMode).width / 2;
    const tx = tgt.position.x + erdAwareNodeSize(tgt, viewMode).width / 2;
    if (tx < sx) { source = "left"; target = "right"; }
  }
  const storedSource = e.sourceHandle === "left" || e.sourceHandle === "right" ? e.sourceHandle : null;
  const storedTarget = e.targetHandle === "left" || e.targetHandle === "right" ? e.targetHandle : null;
  return { source: storedSource ?? source, target: storedTarget ?? target };
}

function compactEdge(e: ModelEdge, sides: { source: Side; target: Side }, relLabelMode: RelLabelMode): Edge {
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: sides.source,
    targetHandle: sides.target,
    type: "rel",
    data: relationEdgeData(e, e.keys, relLabelMode) as unknown as Record<string, unknown>,
  };
}

// Reconnect (dragging an edge end to another port) is scoped to the SELECTED
// relationship only. Otherwise, when several edges share a node handle their
// reconnect anchors overlap and React Flow grabs whichever is topmost -- not the
// one the user picked. ERD view is display-only, so reconnect is off there.
export function isEdgeReconnectable(
  modelEdgeId: string | undefined,
  selectedEdgeId: string | null,
  viewMode: ViewMode,
): boolean {
  return viewMode !== "erd" && modelEdgeId != null && modelEdgeId === selectedEdgeId;
}

export function buildRfEdges(edges: ModelEdge[], nodes: ModelNode[], viewMode: ViewMode, relLabelMode: RelLabelMode = "all"): Edge[] {
  const byKey = new Map(nodes.map(n => [n.key, n]));

  if (viewMode !== "erd") {
    return edges.map(e => compactEdge(e, edgeSides(byKey.get(e.from), byKey.get(e.to), e, viewMode), relLabelMode));
  }

  const fieldsByKey = new Map<string, Set<string>>(
    nodes.map(n => [n.key, new Set(n.schema.map(f => f.name))]),
  );

  return edges.flatMap(e => {
    const sides = edgeSides(byKey.get(e.from), byKey.get(e.to), e, viewMode);
    const usable = e.keys.filter(k => k.left || k.right);
    if (usable.length === 0) return [compactEdge(e, sides, relLabelMode)];

    const srcFields = fieldsByKey.get(e.from);
    const tgtFields = fieldsByKey.get(e.to);
    // Move the anchor vertically onto the field row, keeping the side chosen
    // above. fr:<field> = right edge of the row, fl:<field> = left edge.
    const srcSide = sides.source === "left" ? "fl" : "fr";
    const tgtSide = sides.target === "left" ? "fl" : "fr";

    return usable.map((k, i): Edge => ({
      id: `${e.id}::${i}`,
      source: e.from,
      target: e.to,
      sourceHandle: k.left && srcFields?.has(k.left) ? `${srcSide}:${k.left}` : sides.source,
      targetHandle: k.right && tgtFields?.has(k.right) ? `${tgtSide}:${k.right}` : sides.target,
      type: "rel",
      data: relationEdgeData(e, [k], relLabelMode) as unknown as Record<string, unknown>,
    }));
  });
}
