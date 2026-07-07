import type {
  BlockHost,
  JsonValue,
  ObjectRef,
  ObjectSet,
  ViewDescriptor,
} from '@/lib/block-view/types';

export const CONTAINS_EDGE = 'CONTAINS';

export interface SurfaceTreeNode {
  readonly object: ObjectRef;
  readonly children: readonly SurfaceTreeNode[];
}

export interface SurfaceViewRendererProps {
  readonly set: ObjectSet;
  readonly host: BlockHost;
  readonly descriptor: ViewDescriptor;
  readonly instance: ObjectRef;
  readonly config: Readonly<Record<string, JsonValue>>;
}
