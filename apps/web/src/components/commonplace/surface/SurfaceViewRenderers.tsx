'use client';

import type { JsonValue, ObjectRef } from '@/lib/block-view/types';
import type { SurfaceViewRendererProps } from './types';
import styles from './SurfaceRenderer.module.css';

export function TableSurfaceView({ set, config }: SurfaceViewRendererProps) {
  const fields = fieldsForSet(set, config, 6);

  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field}>{humanize(field)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {set.objects.map((object) => (
            <tr key={object.id}>
              {fields.map((field) => (
                <td key={field}>{displayValue(valueForField(object, field))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoardSurfaceView({ set, config }: SurfaceViewRendererProps) {
  const groupBy = stringConfig(config, 'group_by') ?? stringConfig(config, 'groupBy') ?? 'status';
  const groups = groupObjects(set.objects, groupBy);

  return (
    <div className={styles.board}>
      {groups.map(([group, objects]) => (
        <section key={group} className={styles.boardColumn}>
          <div className={styles.boardHeader}>
            <span>{humanize(group)}</span>
            <span>{objects.length}</span>
          </div>
          <div className={styles.boardStack}>
            {objects.map((object) => (
              <ObjectCard key={object.id} object={object} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CardSurfaceView({ set }: SurfaceViewRendererProps) {
  return (
    <div className={styles.cardGrid}>
      {set.objects.map((object) => (
        <ObjectCard key={object.id} object={object} />
      ))}
    </div>
  );
}

export function ListSurfaceView({ set }: SurfaceViewRendererProps) {
  return (
    <div className={styles.list}>
      {set.objects.map((object) => (
        <ObjectRow key={object.id} object={object} />
      ))}
    </div>
  );
}

export function TimelineSurfaceView({ set }: SurfaceViewRendererProps) {
  const objects = [...set.objects].sort((left, right) => objectTime(right) - objectTime(left));

  return (
    <div className={styles.timeline}>
      {objects.map((object) => (
        <div key={object.id} className={styles.timelineRow}>
          <span className={styles.timelineDot} />
          <div>
            <div className={styles.objectTitle}>{titleFor(object)}</div>
            <div className={styles.objectMeta}>{formatTime(objectTime(object))}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GraphSurfaceView({ set }: SurfaceViewRendererProps) {
  const edges = set.objects.flatMap((object) =>
    Object.entries(object.relations ?? {}).flatMap(([edge, targets]) =>
      targets.map((target) => ({ edge, source: object.id, target })),
    ),
  );

  return (
    <div className={styles.graphList}>
      {set.objects.map((object) => (
        <span key={object.id} className={styles.graphNode}>
          {titleFor(object)}
        </span>
      ))}
      {edges.length > 0 && (
        <div className={styles.edgeList}>
          {edges.slice(0, 16).map((edge) => (
            <div key={`${edge.source}-${edge.edge}-${edge.target}`} className={styles.edgeRow}>
              <span>{edge.source}</span>
              <strong>{edge.edge}</strong>
              <span>{edge.target}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChipSurfaceView({ set }: SurfaceViewRendererProps) {
  return (
    <div className={styles.chips}>
      {set.objects.map((object) => (
        <span key={object.id} className={styles.chip}>
          {titleFor(object)}
        </span>
      ))}
    </div>
  );
}

function ObjectCard({ object, compact = false }: { object: ObjectRef; compact?: boolean }) {
  return (
    <article className={compact ? styles.objectCardCompact : styles.objectCard}>
      <div className={styles.objectType}>{object.type}</div>
      <div className={styles.objectTitle}>{titleFor(object)}</div>
      <div className={styles.objectSummary}>{summaryFor(object)}</div>
    </article>
  );
}

function ObjectRow({ object }: { object: ObjectRef }) {
  return (
    <div className={styles.objectRow}>
      <span className={styles.objectType}>{object.type}</span>
      <span className={styles.objectTitle}>{titleFor(object)}</span>
      <span className={styles.objectSummary}>{summaryFor(object)}</span>
    </div>
  );
}

function fieldsForSet(
  set: SurfaceViewRendererProps['set'],
  config: SurfaceViewRendererProps['config'],
  fallbackLimit: number,
): string[] {
  const configured = arrayConfig(config, 'fields');
  if (configured.length > 0) return configured;
  const fields = set.shape.fields.length > 0 ? set.shape.fields : ['title', 'type'];
  return fields.slice(0, fallbackLimit);
}

function groupObjects(objects: readonly ObjectRef[], field: string): Array<[string, ObjectRef[]]> {
  const groups = new Map<string, ObjectRef[]>();
  for (const object of objects) {
    const key = displayValue(valueForField(object, field)) || 'Unsorted';
    const bucket = groups.get(key) ?? [];
    bucket.push(object);
    groups.set(key, bucket);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function valueForField(object: ObjectRef, field: string): JsonValue | undefined {
  if (field === 'id') return object.id;
  if (field === 'type') return object.type;
  return object.properties[field];
}

function titleFor(object: ObjectRef): string {
  const value = object.properties.title ?? object.properties.name ?? object.properties.display_title;
  return typeof value === 'string' && value.trim() ? value : object.id;
}

function summaryFor(object: ObjectRef): string {
  const value = object.properties.summary ?? object.properties.body_preview ?? object.properties.description;
  return typeof value === 'string' ? value : '';
}

function objectTime(object: ObjectRef): number {
  const candidates = [
    object.properties.updated_at_ms,
    object.properties.created_at_ms,
    object.properties.due_at_ms,
    object.axes?.valid?.from_ms,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function formatTime(value: number): string {
  if (!value) return 'Undated';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function displayValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ');
  return JSON.stringify(value);
}

function stringConfig(
  config: Readonly<Record<string, JsonValue>>,
  field: string,
): string | undefined {
  const value = config[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function arrayConfig(config: Readonly<Record<string, JsonValue>>, field: string): string[] {
  const value = config[field];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
