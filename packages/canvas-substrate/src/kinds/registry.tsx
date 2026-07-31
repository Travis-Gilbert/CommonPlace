'use client';

// SOURCING: @xyflow/react NodeTypes — the registry compiles kind entries into
// the map React Flow expects, so hosts never hand-write a nodeTypes object.
//
// The whole point of issue 144 A: a kind is data plus an optional body, and
// registering one produces a working node without touching NodeShell. The
// generic component below is created once per kind and cached, because React
// Flow re-creates every node when the nodeTypes identity changes.

import { memo, useMemo, type ComponentType } from 'react';
import type { NodeProps, NodeTypes } from '@xyflow/react';
import { NodeShell } from '../shell/NodeShell';
import type {
  AnyNodeKindEntry,
  NodeKindEntry,
  NodeKindId,
  WidgetRenderer,
} from './types';

/**
 * Per-node layout the shell needs but the kind does not own: which ports this
 * reader has hidden. Hosts put it on node data under this key so the registry
 * can read it without a second context provider.
 */
export const SUBSTRATE_LAYOUT_KEY = '__substrate' as const;

export interface SubstrateNodeData {
  readonly [SUBSTRATE_LAYOUT_KEY]?: {
    readonly hiddenPorts?: readonly string[];
  };
}

function kindComponent(
  entry: AnyNodeKindEntry,
  Widget: WidgetRenderer | undefined,
): ComponentType<NodeProps> {
  const accepted = new Set<string>([entry.id, ...(entry.aliases ?? [])]);
  function KindNode({ id, data, type, selected }: NodeProps) {
    // The type erasure above is only sound while a node reaches the entry that
    // matches its own kind. Check it here so a mis-registered node fails by
    // name instead of exploding somewhere inside a body that was handed data
    // of a shape it never expected.
    if (type !== undefined && !accepted.has(type)) {
      return (
        <article
          className="rounded-ij-arc border border-dashed border-ij-warn bg-ij-raised px-2 py-1 text-xs text-ij-warn"
          data-substrate-kind-mismatch={type}
        >
          <span className="font-ij-mono" data-mono-ok>
            {`kind mismatch: node ${id} is ${type}, rendered by ${entry.id}`}
          </span>
        </article>
      );
    }
    const kindData = data as never;
    const model = entry.shell(kindData, { nodeId: id, selected: Boolean(selected) });
    const hidden = (data as SubstrateNodeData)[SUBSTRATE_LAYOUT_KEY]?.hiddenPorts;
    return (
      <NodeShell
        nodeId={id}
        model={entry.frame ? { ...model, frame: true } : model}
        data={kindData}
        selected={Boolean(selected)}
        Body={entry.Body}
        Widget={Widget}
        hiddenPorts={hidden ? new Set(hidden) : undefined}
      />
    );
  }
  KindNode.displayName = `SubstrateKind(${entry.id})`;
  return memo(KindNode);
}

export interface NodeKindRegistry {
  /** Register a kind. Returns the registry so calls chain at module scope. */
  register<TData>(entry: NodeKindEntry<TData>): NodeKindRegistry;
  get(id: NodeKindId): AnyNodeKindEntry | undefined;
  ids(): readonly NodeKindId[];
  /**
   * The React Flow `nodeTypes` map. Stable for a given widget renderer, so
   * callers can pass the result straight through without memoizing again.
   */
  nodeTypes(options?: { readonly Widget?: WidgetRenderer }): NodeTypes;
}

export function createNodeKindRegistry(
  initial: readonly AnyNodeKindEntry[] = [],
): NodeKindRegistry {
  const entries = new Map<NodeKindId, AnyNodeKindEntry>();
  const compiled = new Map<WidgetRenderer | undefined, NodeTypes>();

  const registry: NodeKindRegistry = {
    register<TData>(entry: NodeKindEntry<TData>) {
      entries.set(entry.id, entry as AnyNodeKindEntry);
      compiled.clear();
      return registry;
    },
    get(id) {
      return entries.get(id);
    },
    ids() {
      return [...entries.keys()];
    },
    nodeTypes(options) {
      const Widget = options?.Widget;
      const cached = compiled.get(Widget);
      if (cached) return cached;
      const types: NodeTypes = {};
      for (const [id, entry] of entries) {
        const component = kindComponent(entry, Widget);
        types[id] = component;
        // Aliases resolve to the same component, so a saved graph naming an
        // older type renders without the host hand-splicing the map.
        for (const alias of entry.aliases ?? []) types[alias] = component;
      }
      compiled.set(Widget, types);
      return types;
    },
  };

  for (const entry of initial) registry.register(entry);
  return registry;
}

/** React binding that keeps the compiled nodeTypes stable across renders. */
export function useNodeTypes(
  registry: NodeKindRegistry,
  Widget?: WidgetRenderer,
): NodeTypes {
  return useMemo(() => registry.nodeTypes({ Widget }), [registry, Widget]);
}
