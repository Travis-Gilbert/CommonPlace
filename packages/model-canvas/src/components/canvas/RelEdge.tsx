import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { ModelEdge } from "@commonplace/okf";
import { visibleKeys, showCardinality, type RelLabelMode } from "../../state/relLabels";

export type RelEdgeData = Pick<ModelEdge, "keys" | "bidirectional" | "cardinality"> & {
  relLabelMode?: RelLabelMode;
};

function RelEdgeInner(props: EdgeProps) {
  // Custom <marker> defs are built inline below; RF's markerEnd/markerStart
  // props are intentionally not used.
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
    selected,
  } = props;

  const edgeData = data as unknown as RelEdgeData | undefined;
  const keys = edgeData?.keys ?? [];
  const bidirectional = edgeData?.bidirectional ?? false;
  const cardinality = edgeData?.cardinality;
  const mode: RelLabelMode = edgeData?.relLabelMode ?? "all";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const shownKeys = visibleKeys(keys, mode);
  const label = shownKeys.length > 0
    ? shownKeys.map(k => `${k.left || "?"} = ${k.right || "?"}`).join(", ")
    : "";
  const cardShown = Boolean(cardinality) && showCardinality(keys, mode);

  const strokeColor = selected ? "var(--ij-accent)" : "var(--ij-ink-info)";
  const strokeWidth = selected ? 2.5 : 2;

  return (
    <>
      <defs>
        <marker
          id={`arr-end-${id}`}
          markerWidth="9"
          markerHeight="9"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L7,3 L0,6 z" fill={strokeColor} />
        </marker>
        {bidirectional && (
          <marker
            id={`arr-start-${id}`}
            markerWidth="9"
            markerHeight="9"
            refX="0"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M7,0 L0,3 L7,6 z" fill={strokeColor} />
          </marker>
        )}
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#arr-end-${id})`}
        markerStart={bidirectional ? `url(#arr-start-${id})` : undefined}
        style={{ stroke: strokeColor, strokeWidth }}
      />
      {(label || cardShown) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              background: "var(--ij-raised)",
              border: `1px solid ${selected ? "var(--ij-accent)" : "var(--ij-seam-raised)"}`,
              borderRadius: "var(--ij-arc)",
              padding: "2px 8px",
              color: "var(--ij-ink)",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            className="nodrag nopan font-ij-ui text-xs font-medium"
          >
            {label}
            {cardShown && (
              <span
                style={{
                  padding: "0 5px",
                  borderRadius: "var(--ij-arc-underline)",
                  background: "var(--ij-selection)",
                  color: "var(--ij-accent)",
                }}
                className="text-xs font-bold"
              >
                {cardinality}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelEdge = memo(RelEdgeInner);
