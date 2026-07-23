// SOURCING: none — pure logic, no upstream component applies.
// Wire types follow Obsidian JSON Canvas 1.0 (obsidianmd/jsoncanvas, MIT)
// and SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0 graph-native arrangement shapes.

/**
 * JSON Canvas 1.0 wire types plus graph-native canvas model types.
 * Spec: https://jsoncanvas.org/spec/1.0/ and SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0.
 */

export type CanvasColorPreset = '1' | '2' | '3' | '4' | '5' | '6';
export type CanvasColor = string;

export type NodeSide = 'top' | 'right' | 'bottom' | 'left';
export type EdgeEnd = 'none' | 'arrow';
export type GroupBackgroundStyle = 'cover' | 'ratio' | 'repeat';

/** Custom fields CommonPlace writes; other apps ignore them (spec-valid). */
export interface GraphCanvasMeta {
  readonly graphId?: string;
  readonly provenance?: string;
}

interface GenericNodeFields extends GraphCanvasMeta {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color?: CanvasColor;
}

export interface TextCanvasNode extends GenericNodeFields {
  readonly type: 'text';
  readonly text: string;
}

export interface FileCanvasNode extends GenericNodeFields {
  readonly type: 'file';
  readonly file: string;
  readonly subpath?: string;
}

export interface LinkCanvasNode extends GenericNodeFields {
  readonly type: 'link';
  readonly url: string;
}

export interface GroupCanvasNode extends GenericNodeFields {
  readonly type: 'group';
  readonly label?: string;
  readonly background?: string;
  readonly backgroundStyle?: GroupBackgroundStyle;
}

export type CanvasNode = TextCanvasNode | FileCanvasNode | LinkCanvasNode | GroupCanvasNode;

export interface CanvasEdge extends GraphCanvasMeta {
  readonly id: string;
  readonly fromNode: string;
  readonly fromSide?: NodeSide;
  readonly fromEnd?: EdgeEnd;
  readonly toNode: string;
  readonly toSide?: NodeSide;
  readonly toEnd?: EdgeEnd;
  readonly color?: CanvasColor;
  readonly label?: string;
}

export interface JSONCanvas {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export const EMPTY_CANVAS: JSONCanvas = { nodes: [], edges: [] };

/** Per-card arrangement keyed by (canvasId, objectId). Spec D1. */
export interface CanvasPlacement {
  readonly canvasId: string;
  readonly objectId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly z?: number;
  readonly color?: CanvasColor;
  readonly groupId?: string;
  readonly provenance?: string;
}

export interface CanvasGroup {
  readonly id: string;
  readonly canvasId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label?: string;
  readonly color?: CanvasColor;
  readonly z?: number;
  readonly provenance?: string;
}

export interface CanvasConnection {
  readonly id: string;
  readonly canvasId: string;
  readonly fromObjectId: string;
  readonly toObjectId: string;
  readonly fromSide?: NodeSide;
  readonly toSide?: NodeSide;
  readonly label?: string;
  readonly color?: CanvasColor;
  readonly provenance?: string;
}

/**
 * Referenced object content carried beside placement so export can project
 * without a second round-trip. The canvas never owns a content copy as truth;
 * this is a denormalized projection field for interchange.
 */
export interface CanvasObjectProjection {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly text?: string;
  readonly url?: string;
  readonly filePath?: string;
  readonly subpath?: string;
  readonly color?: CanvasColor;
  readonly provenance?: string;
}

export interface GraphCanvas {
  readonly id: string;
  readonly title: string;
  readonly tenant: string;
  readonly placements: readonly CanvasPlacement[];
  readonly groups: readonly CanvasGroup[];
  readonly connections: readonly CanvasConnection[];
  readonly objects: readonly CanvasObjectProjection[];
}
