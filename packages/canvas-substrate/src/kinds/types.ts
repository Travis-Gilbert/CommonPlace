// SOURCING: none — pure contract types for the canvas substrate (issue #144 A).
//
// One generic node shell hosts every kind. A kind contributes two things and
// nothing else: a projection from its own data onto `NodeShellModel`, and an
// optional body component rendered inside the shell. Registering a kind must
// never require editing the shell, which is why every affordance the shell can
// draw is declared here as data rather than discovered by inspecting the body.

import type { ComponentType, ReactNode } from 'react';

export type NodeKindId = string;

/**
 * Which palette an edge leaving this kind wears (issue #144 B). One geometry
 * and dash system, two palettes: program edges take the source port's
 * shape-class family, model relation edges stay neutral ink.
 */
export type EdgePaletteId = 'program' | 'model';

/**
 * The shape-class families. Capped at five by the program-canvas hue law, so
 * the palette never spends more of the hue budget than a reader can hold.
 */
export type EdgeFamily =
  | 'graph-plane'
  | 'tabular'
  | 'tensor-and-model'
  | 'scalar-value'
  | 'artifact-and-sink';

/** Ports split into an always-visible set and a set behind the shell collapse. */
export type PortSection = 'primary' | 'advanced';

export type PortSide = 'target' | 'source';

/**
 * A parameter row rendered inline on the node (ComfyUI widgets-on-node). The
 * substrate deliberately keeps `fieldType` opaque: the host injects the same
 * renderer the records surface uses for its cells, and only that renderer needs
 * to know the concrete field-type union.
 */
export interface PortWidget {
  readonly fieldType: unknown;
  readonly value: unknown;
  readonly onCommit: (next: unknown) => void;
  readonly label?: string;
  readonly readOnly?: boolean;
}

export interface SubstratePort {
  readonly id: string;
  readonly side: PortSide;
  readonly label?: string;
  readonly section?: PortSection;
  readonly family?: EdgeFamily;
  readonly widget?: PortWidget;
  /**
   * Anchor-only handles give existing edges somewhere to land without offering
   * to start a new connection. ERD field rows use this.
   */
  readonly connectable?: boolean;
  /** Vertical offset in px when the kind body positions its own rows. */
  readonly offset?: number;
}

export type BadgeTone = 'neutral' | 'info' | 'ok' | 'warn' | 'error' | 'accent' | 'gold';

export interface NodeBadge {
  readonly id: string;
  readonly text: string;
  readonly tone?: BadgeTone;
  readonly title?: string;
  /** Machine text (ids, hashes, port names) renders mono and marks itself ok. */
  readonly mono?: boolean;
}

/** Execution flags from the program contracts; both render as a dimmed node. */
export interface NodeFlags {
  readonly bypassed?: boolean;
  readonly muted?: boolean;
}

export type NodeStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'ok'
  | 'refused'
  | 'failed';

/**
 * Everything the shell can draw. A kind fills in what it has; the shell renders
 * only what is present, so kinds stay free to be minimal.
 */
export interface NodeShellModel {
  readonly kindId: NodeKindId;
  readonly title: string;
  readonly icon?: ReactNode;
  /** ComfyUI-style short id badge, e.g. `#66`. Mint with `shortNodeBadge`. */
  readonly idBadge?: string;
  readonly badges?: readonly NodeBadge[];
  readonly ports?: readonly SubstratePort[];
  readonly flags?: NodeFlags;
  readonly status?: NodeStatus;
  readonly statusLabel?: string;
  readonly collapsed?: boolean;
  /** Whether the advanced port section is revealed. */
  readonly advancedOpen?: boolean;
  readonly width?: number;
  /**
   * Frames render as titled regions behind ordinary nodes and carry no ports.
   * Membership is geometry, never content identity.
   */
  readonly frame?: boolean;
  /** Observed-only / not-yet-declared: dashed border, muted ink. */
  readonly ghost?: boolean;
  /** Header accent stripe, used where a source family is worth encoding. */
  readonly accent?: boolean;

  readonly onToggleCollapsed?: () => void;
  readonly onToggleAdvanced?: () => void;
  readonly onToggleFlag?: (flag: keyof NodeFlags) => void;
}

export interface NodeKindContext {
  readonly nodeId: string;
  readonly selected: boolean;
}

export interface WidgetRenderProps {
  readonly fieldType: unknown;
  readonly value: unknown;
  readonly onCommit: (next: unknown) => void;
  readonly onCancel: () => void;
}

/**
 * Injected by the host so the substrate never owns a second field-editor map.
 * The console passes an adapter over the records-surface editors.
 */
export type WidgetRenderer = ComponentType<WidgetRenderProps>;

export interface NodeKindBodyProps<TData> {
  readonly nodeId: string;
  readonly data: TData;
  readonly selected: boolean;
  readonly Widget?: WidgetRenderer;
}

export interface NodeKindEntry<TData = never> {
  readonly id: NodeKindId;
  /** Projects this kind's own data onto the shell contract. */
  readonly shell: (data: TData, context: NodeKindContext) => NodeShellModel;
  readonly Body?: ComponentType<NodeKindBodyProps<TData>>;
  readonly palette?: EdgePaletteId;
  /** Frames are registered like any other kind; the shell reads this too. */
  readonly frame?: boolean;
}
