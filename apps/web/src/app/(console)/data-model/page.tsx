'use client';

// TW4 data-model page: stateful type editing over DataCanvas.
// Maintains a live TypeDef[] array via a BlockHost that applies
// create / update (addField, renameField, deleteField) / link / delete
// mutations. Positions persist to localStorage and survive reload.

import { useState, useCallback, useMemo, type FC } from 'react';
import { DataCanvas } from '@/components/v2/data-canvas';
import {
  type BlockHost,
  type ObjectAction,
  type ObjectActionReceipt,
  type ObjectSet,
  type ObjectShape,
  type ThemeTokens,
  type TypeDef,
  type ViewDescriptor,
} from '@/lib/block-view/types';
import type { PositionMap } from '@/components/v2/data-canvas/canvas-logic';

// ── Seed types ──

const EMPTY_AXES: TypeDef['axes'] = {};

const INITIAL_TYPES: TypeDef[] = [
  {
    name: 'User',
    properties: [
      { name: 'id', type: 'id' as const },
      { name: 'name', type: 'string' as const },
      { name: 'email', type: 'string' as const },
      { name: 'avatarUrl', type: 'string' as const },
      { name: 'createdAt', type: 'timestamp_ms' as const },
    ],
    relations: [
      { edge: 'posts', dir: 'out' as const, target: 'Post' },
      { edge: 'comments', dir: 'out' as const, target: 'Comment' },
    ],
    axes: EMPTY_AXES,
  },
  {
    name: 'Post',
    properties: [
      { name: 'id', type: 'id' as const },
      { name: 'title', type: 'string' as const },
      { name: 'body', type: 'text' as const },
      { name: 'published', type: 'boolean' as const },
      { name: 'createdAt', type: 'timestamp_ms' as const },
    ],
    relations: [
      { edge: 'author', dir: 'out' as const, target: 'User' },
      { edge: 'comments', dir: 'out' as const, target: 'Comment' },
    ],
    axes: EMPTY_AXES,
  },
  {
    name: 'Comment',
    properties: [
      { name: 'id', type: 'id' as const },
      { name: 'body', type: 'text' as const },
      { name: 'createdAt', type: 'timestamp_ms' as const },
    ],
    relations: [
      { edge: 'post', dir: 'out' as const, target: 'Post' },
      { edge: 'author', dir: 'out' as const, target: 'User' },
    ],
    axes: EMPTY_AXES,
  },
];

// ── Position persistence ──

const POSITIONS_KEY = 'cp:data-model:positions';

function loadPositions(): PositionMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as PositionMap) : {};
  } catch {
    return {};
  }
}

function savePositions(pos: PositionMap): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos));
  } catch {
    /* quota exceeded, ignore */
  }
}

// ── Helpers ──

function applied(note: string): ObjectActionReceipt {
  return { action_kind: '' as ObjectActionReceipt['action_kind'], status: 'applied', note };
}

// ── Page ──

const DataModelPage: FC = () => {
  const [types, setTypes] = useState<TypeDef[]>(INITIAL_TYPES);
  const [positions, setPositions] = useState<PositionMap>(() => loadPositions());

  const handlePositionsChange = useCallback((pos: PositionMap) => {
    setPositions(pos);
    savePositions(pos);
  }, []);

  const host: BlockHost = useMemo(
    () => ({
      async emit(action: ObjectAction) {
        const receipt: ObjectActionReceipt = (() => {
          switch (action.kind) {
            case 'link': {
              setTypes((prev) =>
                prev.map((t) => {
                  if (t.name !== action.from) return t;
                  const dup = t.relations.some(
                    (r) => r.edge === action.edge && r.target === action.to,
                  );
                  if (dup) return t;
                  return {
                    ...t,
                    relations: [
                      ...t.relations,
                      { edge: action.edge, dir: 'out' as const, target: action.to },
                    ],
                  };
                }),
              );
              return applied(`relation ${action.from}.${action.edge} → ${action.to}`);
            }

            case 'update': {
              const patch = action.patch as Record<string, unknown>;
              if (patch.addField) {
                const { name, type } = patch.addField as { name: string; type: string };
                setTypes((prev) =>
                  prev.map((t) => {
                    if (t.name !== action.id) return t;
                    if (t.properties.some((p) => p.name === name)) return t;
                    return {
                      ...t,
                      properties: [...t.properties, { name, type: type as TypeDef['properties'][number]['type'] }],
                    };
                  }),
                );
                return applied(`added field ${name}:${type} to ${action.id}`);
              }
              if (patch.deleteField) {
                const { name } = patch.deleteField as { name: string };
                setTypes((prev) =>
                  prev.map((t) => {
                    if (t.name !== action.id) return t;
                    return { ...t, properties: t.properties.filter((p) => p.name !== name) };
                  }),
                );
                return applied(`removed field ${name} from ${action.id}`);
              }
              if (patch.renameField) {
                const { from, to, type } = patch.renameField as {
                  from: string;
                  to: string;
                  type: string;
                };
                setTypes((prev) =>
                  prev.map((t) => {
                    if (t.name !== action.id) return t;
                    return {
                      ...t,
                      properties: t.properties.map((p) =>
                        p.name === from
                          ? { name: to, type: type as TypeDef['properties'][number]['type'] }
                          : p,
                      ),
                    };
                  }),
                );
                return applied(`renamed field ${from} → ${to} in ${action.id}`);
              }
              return { status: 'deferred' as const, action_kind: 'update' as const, note: 'unknown patch' };
            }

            case 'create': {
              setTypes((prev) => [
                ...prev,
                { name: action.type, properties: [], relations: [], axes: EMPTY_AXES },
              ]);
              return applied(`created type ${action.type}`);
            }

            case 'delete': {
              setTypes((prev) => prev.filter((t) => t.name !== action.id));
              return applied(`deleted type ${action.id}`);
            }

            default:
              return { status: 'accepted' as const, action_kind: action.kind, note: 'noop' };
          }
        })();

        return { ok: true as const, value: receipt };
      },

      async query(): Promise<ObjectSet> {
        const emptySet: ObjectSet = {
          objects: [],
          shape: { types: [], fields: [], relations: [], axes: {}, cardinality: "empty" as const },
          subscribe: () => () => {},
        };
        return emptySet;
      },

      viewsFor(_shape: ObjectShape): readonly ViewDescriptor[] {
        return [];
      },

      tokens: {} as unknown as ThemeTokens,
    }),
    [],
  );

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <DataCanvas
        types={types}
        host={host}
        initialPositions={positions}
        onPositionsChange={handlePositionsChange}
      />
    </div>
  );
};

export default DataModelPage;
