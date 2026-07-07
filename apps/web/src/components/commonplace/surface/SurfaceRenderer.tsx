'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { GripVertical, Plus, Save, Settings, X } from 'lucide-react';
import type {
  BlockHost,
  JsonValue,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  ViewDescriptor,
} from '@/lib/block-view/types';
import { SURFACE_RENDERER_MODULES } from './surface-renderer-map';
import {
  computeInsertOptions,
  insertViewInstance,
  moveSurfaceNodeAction,
  updateViewInstanceConfigAction,
} from './surface-actions';
import type { SurfaceTreeNode } from './types';
import { CONTAINS_EDGE } from './types';
import styles from './SurfaceRenderer.module.css';

interface SurfaceRendererProps {
  readonly surfaceId: string;
  readonly host: BlockHost;
  readonly className?: string;
  readonly chrome?: boolean;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly set: ObjectSet };

export default function SurfaceRenderer({
  surfaceId,
  host,
  className,
  chrome = true,
}: SurfaceRendererProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      setState({ kind: 'loading' });
      try {
        const set = await host.query(surfaceQuery());
        if (!active) return;
        setState({ kind: 'ready', set });
        if (typeof set.subscribe === 'function') {
          unsubscribe = set.subscribe((next) => {
            if (active) setState({ kind: 'ready', set: next });
          });
        }
      } catch (error) {
        if (!active) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Surface unavailable.',
        });
      }
    }

    void load();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [host, version]);

  if (state.kind === 'loading') {
    return <div className={styles.statusText}>Loading surface.</div>;
  }

  if (state.kind === 'error') {
    return <div className={styles.statusText}>{state.message}</div>;
  }

  const root = buildSurfaceTree(surfaceId, state.set.objects);
  if (!root) {
    return <div className={styles.statusText}>Surface unavailable.</div>;
  }

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-chrome={chrome ? 'true' : 'false'}
    >
      {chrome && (
        <div className={styles.surfaceHeader}>
          <h2 className={styles.surfaceTitle}>{stringProp(root.object, 'name') ?? titleFor(root.object)}</h2>
          <span className={styles.surfaceKind}>{stringProp(root.object, 'kind') ?? root.object.type}</span>
        </div>
      )}
      {root.children.length === 0 ? (
        <div className={styles.emptyState}>No regions.</div>
      ) : (
        root.children.map((child, index) => (
          <SurfaceNode
            key={child.object.id}
            node={child}
            host={host}
            chrome={chrome}
            orderBase={index}
            onChanged={reload}
          />
        ))
      )}
    </div>
  );
}

function SurfaceNode({
  node,
  host,
  chrome,
  orderBase,
  onChanged,
}: {
  readonly node: SurfaceTreeNode;
  readonly host: BlockHost;
  readonly chrome: boolean;
  readonly orderBase: number;
  readonly onChanged: () => void;
}) {
  if (node.object.type === 'region') {
    return (
      <RegionNode
        node={node}
        host={host}
        chrome={chrome}
        orderBase={orderBase}
        onChanged={onChanged}
      />
    );
  }

  if (node.object.type === 'view-instance') {
    return (
      <ViewInstanceNode
        instance={node.object}
        host={host}
        chrome={chrome}
        onChanged={onChanged}
      />
    );
  }

  return (
    <FallbackCard
      title={titleFor(node.object)}
      type={node.object.type}
      props={node.object.properties}
    />
  );
}

function RegionNode({
  node,
  host,
  chrome,
  orderBase,
  onChanged,
}: {
  readonly node: SurfaceTreeNode;
  readonly host: BlockHost;
  readonly chrome: boolean;
  readonly orderBase: number;
  readonly onChanged: () => void;
}) {
  const [insertOpen, setInsertOpen] = useState(false);
  const layout = stringProp(node.object, 'layout') ?? 'stack';
  const style = regionStyle(node.object, node.children.length);
  const nextOrder = orderBase + node.children.length + 1;

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (!chrome) return;
      const id = event.dataTransfer.getData('application/commonplace-surface-id');
      if (!id) return;
      event.preventDefault();
      const result = await host.emit(moveSurfaceNodeAction(id, node.object.id, nextOrder));
      if (result.ok) onChanged();
    },
    [chrome, host, nextOrder, node.object.id, onChanged],
  );

  return (
    <section
      className={styles.region}
      data-layout={layout}
      style={style}
      onDragOver={chrome ? (event) => event.preventDefault() : undefined}
      onDrop={handleDrop}
    >
      {chrome && (
        <div className={styles.regionChrome}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setInsertOpen(true)}
            title="Insert view"
          >
            <Plus size={15} />
          </button>
          {insertOpen && (
            <SurfaceInsertPopover
              regionId={node.object.id}
              host={host}
              order={nextOrder}
              onClose={() => setInsertOpen(false)}
              onChanged={() => {
                setInsertOpen(false);
                onChanged();
              }}
            />
          )}
        </div>
      )}
      {node.children.length === 0 ? (
        <div className={styles.emptyState}>Empty region.</div>
      ) : (
        node.children.map((child, index) => (
          <SurfaceNode
            key={child.object.id}
            node={child}
            host={host}
            chrome={chrome}
            orderBase={index}
            onChanged={onChanged}
          />
        ))
      )}
    </section>
  );
}

function ViewInstanceNode({
  instance,
  host,
  chrome,
  onChanged,
}: {
  readonly instance: ObjectRef;
  readonly host: BlockHost;
  readonly chrome: boolean;
  readonly onChanged: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [configOpen, setConfigOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const query = useMemo(() => objectQueryForInstance(instance), [instance]);
  const config = recordProp(instance, 'config') ?? {};

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      if (!query) {
        setState({ kind: 'error', message: 'view unavailable' });
        return;
      }
      setState({ kind: 'loading' });
      try {
        const set = await host.query(query);
        if (!active) return;
        setState({ kind: 'ready', set });
        if (typeof set.subscribe === 'function') {
          unsubscribe = set.subscribe((next) => {
            if (active) setState({ kind: 'ready', set: next });
          });
        }
      } catch (error) {
        if (!active) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'view unavailable',
        });
      }
    }

    void load();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [host, query]);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!chrome) return;
      setDragging(true);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/commonplace-surface-id', instance.id);
    },
    [chrome, instance.id],
  );

  const title = stringProp(instance, 'title') ?? titleFor(instance);
  const descriptorId = stringProp(instance, 'descriptor_id');

  return (
    <article
      className={styles.viewInstance}
      draggable={chrome}
      data-dragging={dragging ? 'true' : 'false'}
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
    >
      {chrome && (
        <div className={styles.instanceChrome}>
          <button type="button" className={`${styles.iconButton} ${styles.dragHandle}`} title="Move view">
            <GripVertical size={15} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setConfigOpen(true)}
            title="Configure view"
          >
            <Settings size={15} />
          </button>
          {configOpen && (
            <ConfigPopover
              instance={instance}
              host={host}
              config={config}
              onClose={() => setConfigOpen(false)}
              onChanged={() => {
                setConfigOpen(false);
                onChanged();
              }}
            />
          )}
        </div>
      )}
      <div className={styles.viewShell}>
        {chrome && (
          <div className={styles.viewHeader}>
            <h3 className={styles.viewTitle}>{title}</h3>
            <span className={styles.objectMeta}>{descriptorId ?? 'view'}</span>
          </div>
        )}
        <div className={styles.viewBody}>
          <ResolvedView state={state} host={host} instance={instance} config={config} />
        </div>
      </div>
    </article>
  );
}

function ResolvedView({
  state,
  host,
  instance,
  config,
}: {
  readonly state: LoadState;
  readonly host: BlockHost;
  readonly instance: ObjectRef;
  readonly config: Readonly<Record<string, JsonValue>>;
}) {
  if (state.kind === 'loading') {
    return <div className={styles.statusText}>Loading view.</div>;
  }

  const descriptorId = stringProp(instance, 'descriptor_id');
  if (state.kind === 'error' || !descriptorId) {
    return (
      <FallbackCard
        title={stringProp(instance, 'title') ?? titleFor(instance)}
        type={instance.type}
        props={instance.properties}
        note={state.kind === 'error' ? state.message : 'view unavailable'}
      />
    );
  }

  const descriptor = host.viewsFor(state.set.shape).find((view) => view.id === descriptorId);
  if (!descriptor) {
    return (
      <FallbackCard
        title={stringProp(instance, 'title') ?? titleFor(instance)}
        type={instance.type}
        props={instance.properties}
        note="view unavailable"
      />
    );
  }

  const Renderer = SURFACE_RENDERER_MODULES[descriptor.renderer];
  if (!Renderer) {
    return (
      <FallbackCard
        title={descriptor.name}
        type={instance.type}
        props={instance.properties}
        note="view unavailable"
      />
    );
  }

  return (
    <>
      {state.set.notes?.map((note) => (
        <div key={note} className={styles.statusText}>
          {note}
        </div>
      ))}
      {state.set.objects.length === 0 ? (
        <div className={styles.emptyState}>No objects returned.</div>
      ) : (
        <Renderer
          set={state.set}
          host={host}
          descriptor={descriptor}
          instance={instance}
          config={config}
        />
      )}
    </>
  );
}

function SurfaceInsertPopover({
  regionId,
  host,
  order,
  onClose,
  onChanged,
}: {
  readonly regionId: string;
  readonly host: BlockHost;
  readonly order: number;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}) {
  const [queryText, setQueryText] = useState('{\n  "types": ["task"],\n  "live": true\n}');
  const [views, setViews] = useState<readonly ViewDescriptor[]>([]);
  const [pendingQuery, setPendingQuery] = useState<ObjectQuery | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const compute = useCallback(async () => {
    const query = parseObjectQuery(queryText);
    if (!query) {
      setStatus('Query is invalid.');
      return;
    }
    setStatus('Loading views.');
    try {
      const next = await computeInsertOptions(host, query);
      setPendingQuery(query);
      setViews(next.views);
      setStatus(next.views.length === 0 ? 'No matching views.' : null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Views unavailable.');
    }
  }, [host, queryText]);

  const insert = useCallback(
    async (descriptor: ViewDescriptor) => {
      if (!pendingQuery) return;
      setStatus('Saving view.');
      const result = await insertViewInstance(host, regionId, descriptor, pendingQuery, order);
      if (result.ok) {
        onChanged();
      } else {
        setStatus(result.error ?? 'View insert failed.');
      }
    },
    [host, onChanged, order, pendingQuery, regionId],
  );

  return (
    <div className={styles.popover}>
      <div className={styles.popoverHeader}>
        <h4 className={styles.popoverTitle}>Insert view</h4>
        <button type="button" className={styles.iconButton} onClick={onClose} title="Close">
          <X size={15} />
        </button>
      </div>
      <textarea
        className={styles.textarea}
        value={queryText}
        onChange={(event) => setQueryText(event.target.value)}
      />
      <div className={styles.toolbar}>
        <button type="button" className={styles.commandButton} onClick={compute}>
          <Plus size={14} />
          Views
        </button>
      </div>
      {status && <div className={styles.statusText}>{status}</div>}
      {views.length > 0 && (
        <div className={styles.viewOptionList}>
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={styles.viewOption}
              onClick={() => void insert(view)}
            >
              {view.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigPopover({
  instance,
  host,
  config,
  onClose,
  onChanged,
}: {
  readonly instance: ObjectRef;
  readonly host: BlockHost;
  readonly config: Readonly<Record<string, JsonValue>>;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}) {
  const [text, setText] = useState(JSON.stringify(config, null, 2));
  const [status, setStatus] = useState<string | null>(null);

  const save = useCallback(async () => {
    const parsed = parseJsonRecord(text);
    if (!parsed) {
      setStatus('Config is invalid.');
      return;
    }
    const result = await host.emit(updateViewInstanceConfigAction(instance.id, parsed));
    if (result.ok) {
      onChanged();
    } else {
      setStatus(result.error ?? 'Config save failed.');
    }
  }, [host, instance.id, onChanged, text]);

  return (
    <div className={styles.popover}>
      <div className={styles.popoverHeader}>
        <h4 className={styles.popoverTitle}>Config</h4>
        <button type="button" className={styles.iconButton} onClick={onClose} title="Close">
          <X size={15} />
        </button>
      </div>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.toolbar}>
        <button type="button" className={styles.commandButton} onClick={() => void save()}>
          <Save size={14} />
          Save
        </button>
      </div>
      {status && <div className={styles.statusText}>{status}</div>}
    </div>
  );
}

function FallbackCard({
  title,
  type,
  props,
  note = 'view unavailable',
}: {
  readonly title: string;
  readonly type: string;
  readonly props: Readonly<Record<string, JsonValue>>;
  readonly note?: string;
}) {
  return (
    <div className={styles.fallbackCard}>
      <div className={styles.objectType}>{type}</div>
      <div className={styles.objectTitle}>{title}</div>
      <div className={styles.objectSummary}>{note}</div>
      <pre className={styles.fallbackPre}>{JSON.stringify(props, null, 2)}</pre>
    </div>
  );
}

function buildSurfaceTree(surfaceId: string, objects: readonly ObjectRef[]): SurfaceTreeNode | null {
  const map = new Map(objects.map((object) => [object.id, object]));
  return buildNode(surfaceId, map, new Set());
}

function buildNode(
  id: string,
  map: ReadonlyMap<string, ObjectRef>,
  visited: Set<string>,
): SurfaceTreeNode | null {
  const object = map.get(id);
  if (!object || visited.has(id)) return null;
  visited.add(id);
  const children = (object.relations?.[CONTAINS_EDGE] ?? [])
    .map((childId) => buildNode(childId, map, visited))
    .filter((node): node is SurfaceTreeNode => node !== null);
  visited.delete(id);
  return { object, children };
}

function surfaceQuery(): ObjectQuery {
  return {
    types: ['surface', 'region', 'view-instance'],
    traverse: [{ edge: CONTAINS_EDGE, dir: 'out' }],
    live: true,
  };
}

function objectQueryForInstance(instance: ObjectRef): ObjectQuery | null {
  return toObjectQuery(instance.properties.query ?? instance.properties.object_query);
}

function regionStyle(object: ObjectRef, childCount: number): CSSProperties {
  const gap = numberProp(object, 'gap');
  const ratios = numberArrayProp(object, 'ratios');
  const layout = stringProp(object, 'layout');
  const style: CSSProperties & { '--surface-region-gap'?: string } = {};
  if (gap !== undefined) style['--surface-region-gap'] = `${gap}px`;
  if (layout === 'split-h' && ratios.length === childCount && ratios.length > 1) {
    style.gridTemplateColumns = ratios.map((ratio) => `${Math.max(ratio, 0.1)}fr`).join(' ');
  }
  return style;
}

function parseObjectQuery(text: string): ObjectQuery | null {
  try {
    return toObjectQuery(JSON.parse(text));
  } catch {
    return null;
  }
}

function toObjectQuery(value: unknown): ObjectQuery | null {
  const raw = typeof value === 'string' ? parseJson(value) : value;
  if (!isRecord(raw)) return null;
  const types = Array.isArray(raw.types)
    ? raw.types.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return {
    ...(raw as Record<string, unknown>),
    types,
    live: raw.live === false ? false : true,
  } as ObjectQuery;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonRecord(value: string): Readonly<Record<string, JsonValue>> | null {
  const parsed = parseJson(value);
  return isJsonRecord(parsed) ? parsed : null;
}

function recordProp(
  object: ObjectRef,
  field: string,
): Readonly<Record<string, JsonValue>> | undefined {
  const value = object.properties[field];
  return isJsonRecord(value) ? value : undefined;
}

function stringProp(object: ObjectRef, field: string): string | undefined {
  const value = object.properties[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberProp(object: ObjectRef, field: string): number | undefined {
  const value = object.properties[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function numberArrayProp(object: ObjectRef, field: string): number[] {
  const value = object.properties[field];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
}

function titleFor(object: ObjectRef): string {
  return stringProp(object, 'title') ?? stringProp(object, 'name') ?? object.id;
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, JsonValue>> {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}
