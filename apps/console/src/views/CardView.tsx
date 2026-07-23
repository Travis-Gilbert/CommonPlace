'use client';

// SOURCING: @commonplace/block-view (host query/emit; templates and objects
// arrive through the seam) + @tanstack/react-virtual (ledger row: row
// virtualization) for the card grid. The card engine (K1): one renderer for
// any kind-templated card. `card.full` mounts in panes and documents,
// `card.compact` in the inspector head and popovers, `cards.grid` renders an
// ObjectQuery as faces at Twenty density. Structure uses --rec-* metrics,
// paint is the Int UI register.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  BlockHost,
  JsonValue,
  ObjectRef,
  ViewRenderProps,
} from '@commonplace/block-view/types';
import {
  CARD_TEMPLATE_TYPE,
  dynamicFactRows,
  resolveCardTemplate,
  type CardChipSpec,
  type ResolvedCardTemplate,
} from '@/lib/card-templates';
import { CopyAddressButton } from '@/components/shell/CopyAddressButton';
import { objectAddress } from '@/lib/object-address';
import { objectChip, useShellStore } from '@/lib/shell-store';
import { MentionsSection, UnlinkedMentionsChip } from './MentionsSection';
import { ViewState } from './ViewStates';

/** Templates are objects: the engine queries them through the same seam any
 *  record rides. The set is tiny and stable; one query per mounted surface. */
export function useCardTemplates(host: BlockHost): readonly ObjectRef[] {
  const [templates, setTemplates] = useState<readonly ObjectRef[]>([]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    Promise.resolve(host.query({ types: [CARD_TEMPLATE_TYPE] }))
      .then((set) => {
        if (!active) return;
        setTemplates(set.objects);
        unsubscribe = set.subscribe((next) => {
          if (active) setTemplates(next.objects);
        });
      })
      .catch(() => {
        // No templates reachable: every card renders generic, never an error.
        if (active) setTemplates([]);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [host]);
  return templates;
}

function textValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

/** Resolve chip target titles: one bounded query per target kind, mapped by
 *  id. Unresolved ids still render (the id is the honest fallback label). */
function useChipTitles(
  host: BlockHost,
  object: ObjectRef,
  chips: readonly CardChipSpec[],
): ReadonlyMap<string, string> {
  const kinds = useMemo(() => {
    const wanted = new Set<string>();
    for (const chip of chips) {
      const related = object.relations?.[chip.edge] ?? [];
      if (related.length > 0 && chip.targetKind) wanted.add(chip.targetKind);
    }
    return [...wanted].sort();
  }, [chips, object]);
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (kinds.length === 0) return;
    let active = true;
    Promise.resolve(host.query({ types: kinds, page: { limit: 200 } }))
      .then((set) => {
        if (!active) return;
        const next = new Map<string, string>();
        for (const target of set.objects) {
          next.set(target.id, textValue(target.properties.title) || target.id);
        }
        setTitles(next);
      })
      .catch(() => {
        // Titles stay ids; the chip still opens the object.
      });
    return () => {
      active = false;
    };
  }, [host, kinds]);
  return titles;
}

export type CardSize = 'full' | 'compact';

export interface RecordCardProps {
  readonly object: ObjectRef;
  readonly host: BlockHost;
  readonly size: CardSize;
  /** Extra sections a mount injects under the facts (the Mentions section
   *  mounts here in K6). */
  readonly children?: React.ReactNode;
}

/** The card engine: renders any object through its kind's template. */
export function RecordCard({ object, host, size, children }: RecordCardProps) {
  const templates = useCardTemplates(host);
  const resolved = useMemo(
    () => resolveCardTemplate(templates, object.type),
    [templates, object.type],
  );
  return (
    <ResolvedCard object={object} host={host} size={size} resolved={resolved}>
      {children}
    </ResolvedCard>
  );
}

function ResolvedCard({
  object,
  host,
  size,
  resolved,
  children,
}: RecordCardProps & { readonly resolved: ResolvedCardTemplate }) {
  const selectRecord = useShellStore((state) => state.selectRecord);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const tenant = useShellStore((state) => state.tenant);
  const { spec, fallbackNote } = resolved;
  const title = textValue(object.properties[spec.identity.titleField]) || object.id;
  const subtitle = (spec.identity.subtitleFields ?? [])
    .map((field) => textValue(object.properties[field]))
    .filter(Boolean)
    .join(' · ');
  const image = spec.identity.imageField
    ? textValue(object.properties[spec.identity.imageField])
    : '';
  const facts =
    spec.facts.length > 0 || !spec.dynamicFacts ? spec.facts : dynamicFactRows(object, spec);
  const chipTitles = useChipTitles(host, object, spec.chips);

  return (
    <article
      data-card={size}
      data-card-kind={spec.kind}
      className="min-w-0"
    >
      <section data-block-section="identity">
      <header className="flex items-center gap-2 p-rec-cell-pad">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-8 w-8 shrink-0 object-cover"
          />
        ) : (
          <span
            aria-hidden
            data-card-no-image
            className="flex h-8 w-8 shrink-0 items-center justify-center font-ij-mono text-ij-ink-info"
          >
            {(title[0] ?? '?').toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {title}
          </h3>
          {subtitle ? <p className="truncate text-ij-ink-info">{subtitle}</p> : null}
        </div>
        <UnlinkedMentionsChip host={host} object={object} />
        {size === 'full' ? (
          <>
            {/* Copy-address (DESIGN-THEOREM-URI section 3) joins the card's
                action treatment: the compact head carries no actions of its
                own, and its mount (the inspector) shows the address in its
                footer. */}
            <CopyAddressButton
              address={objectAddress(tenant, object)}
              name={title}
              className="ml-2 inline-flex h-6 w-8 shrink-0 items-center justify-center text-ij-ink-info hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
            />
            <button
              type="button"
              data-card-action
              aria-label={`Hand ${title} to the agent`}
              onClick={() =>
                // The Action verb (K3): one of the three entries into the one
                // sheet, with this object pre-staged as the originating chip.
                openActionSheet({ chips: [objectChip(object.id, object.type, title)] })
              }
              className="ml-2 h-6 shrink-0 px-2 text-ij-ink-info hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
              style={{ transition: 'var(--rec-clickable-transition)' }}
            >
              Action
            </button>
          </>
        ) : null}
      </header>

      {fallbackNote ? (
        <p data-card-fallback-note className="p-rec-cell-pad text-ij-ink-info">
          {fallbackNote}; showing the generic card.
        </p>
      ) : null}
      </section>

      <section data-block-section="substance">
      {size === 'full' && spec.gauges.length > 0 ? (
        <div className="p-rec-cell-pad">
          {spec.gauges.map((gauge) => {
            const rawValue = object.properties[gauge.field];
            const value = typeof rawValue === 'number' ? rawValue : 0;
            const max = gauge.max ?? 100;
            const share = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
            return (
              <div key={gauge.field} className="mb-1 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-ij-ink-info">{gauge.label ?? gauge.field}</span>
                  <span className="font-ij-mono text-ij-ink">{Math.round(share * 100)}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(share * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={gauge.label ?? gauge.field}
                  className="mt-1 h-1 w-full overflow-hidden"
                  style={{ background: 'var(--ij-hover-surface)' }}
                >
                  <div
                    className="h-full"
                    style={{ width: `${Math.round(share * 100)}%`, background: 'var(--ij-accent)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {size === 'full' && facts.length > 0 ? (
        <dl className="p-rec-cell-pad">
          {facts.map((fact) => {
            const value = textValue(object.properties[fact.field]);
            if (!value) return null;
            return (
              <div key={fact.field} className="flex items-baseline gap-2 py-px">
                <dt className="w-24 shrink-0 truncate text-ij-ink-info">
                  {fact.label ?? fact.field}
                </dt>
                <dd className="min-w-0 truncate text-ij-ink">{value}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      </section>

      <section data-block-section="relations">
      {spec.chips.some((chip) => (object.relations?.[chip.edge] ?? []).length > 0) ? (
        <div className="flex flex-wrap gap-1 p-rec-cell-pad">
          {spec.chips.flatMap((chip) =>
            (object.relations?.[chip.edge] ?? []).map((relatedId) => (
              <button
                key={`${chip.edge}:${relatedId}`}
                type="button"
                data-card-chip={chip.edge}
                onClick={(event) => {
                  // A chip is its own navigation: never let the click fall
                  // through to a wrapping grid cell's select.
                  event.stopPropagation();
                  selectRecord(relatedId, null, chip.targetKind ?? null);
                }}
                className="inline-flex h-6 items-center gap-1 px-2 text-ij-ink hover:text-ij-accent focus:outline-2 focus:outline-ij-accent"
                style={{ transition: 'var(--rec-clickable-transition)' }}
              >
                <span className="text-ij-ink-info">{chip.label ?? chip.edge}</span>
                <span className="max-w-40 truncate">{chipTitles.get(relatedId) ?? relatedId}</span>
              </button>
            )),
          )}
        </div>
      ) : null}

      <MentionsSection host={host} object={object} />

      {children}
      </section>
    </article>
  );
}

/** The `card.full` descriptor render: the first object of the set through its
 *  template. An empty set renders the shared empty state. */
export function CardFullView({ set, host }: ViewRenderProps) {
  const object = set.objects[0];
  if (!object) return <ViewState state="empty" mode="shell" />;
  return (
    <div className="h-full overflow-y-auto">
      <RecordCard object={object} host={host} size="full" />
    </div>
  );
}

const GRID_MIN_COLUMN = 280;
const GRID_ROW_ESTIMATE = 128;

/** The `cards.grid` descriptor render (K2): an ObjectQuery as a card grid at
 *  Twenty density, virtualized past 200 cards, keyboard focus row-major. */
export function CardGridView({ set, host }: ViewRenderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () =>
      setColumns(Math.max(1, Math.floor(node.clientWidth / GRID_MIN_COLUMN)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => {
    const grouped: ObjectRef[][] = [];
    for (let i = 0; i < set.objects.length; i += columns) {
      grouped.push(set.objects.slice(i, i + columns) as ObjectRef[]);
    }
    return grouped;
  }, [set.objects, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => GRID_ROW_ESTIMATE,
    overscan: 4,
  });

  if (set.objects.length === 0) return <ViewState state="empty" mode="shell" />;

  return (
    <div
      ref={scrollRef}
      data-cards-grid
      className="h-full overflow-y-auto"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className="absolute left-0 top-0 grid w-full gap-2 pb-2"
            style={{
              transform: `translateY(${row.start}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {rows[row.index]?.map((object) => (
              <CardGridCell key={object.id} object={object} host={host} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardGridCell({ object, host }: { object: ObjectRef; host: BlockHost }) {
  const selectRecord = useShellStore((state) => state.selectRecord);
  return (
    <div
      role="button"
      tabIndex={0}
      data-card-cell={object.id}
      aria-label={`Open ${textValue(object.properties.title) || object.id}`}
      onClick={() => selectRecord(object.id, object, object.type)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectRecord(object.id, object, object.type);
        }
      }}
      className="cursor-default focus:outline-2 focus:outline-ij-accent"
    >
      <RecordCard object={object} host={host} size="compact" />
    </div>
  );
}
