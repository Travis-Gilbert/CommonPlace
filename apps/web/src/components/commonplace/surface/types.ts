import type {
  BlockHost,
  JsonValue,
  ObjectRef,
  ObjectSet,
  ViewDescriptor,
} from '@/lib/block-view/types';

/**
 * The surface tree constants and node shape now live in packages/block-view
 * (HANDOFF-GREENFIELD-CONSOLE G0); this re-export keeps existing import paths
 * working. SurfaceViewRendererProps stays app-side: it is the web renderer
 * prop contract, and the package carries zero components.
 */
export { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
export type { SurfaceTreeNode } from '@commonplace/block-view/surface-tree';

export interface SurfaceViewRendererProps {
  readonly set: ObjectSet;
  readonly host: BlockHost;
  readonly descriptor: ViewDescriptor;
  readonly instance: ObjectRef;
  readonly config: Readonly<Record<string, JsonValue>>;
}
