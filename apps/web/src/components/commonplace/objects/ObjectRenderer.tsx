'use client';

import type { ObjectListItem, PinnedBadgeObject, TagSummary } from '@/lib/commonplace';
import PinnedBadge from './PinnedBadge';
import StatusBadge from './StatusBadge';
import SignalPips from './SignalPips';
import { useState, useCallback, useRef, useEffect } from 'react';
import { createPin } from '@/lib/commonplace-api';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import RoughBorder from '../shared/RoughBorder';
import LensAffordance from '../lenses/LensAffordance';
import { OBJECT_RENDERER_REGISTRY } from './objectRendererRegistry';

/* ── Types ── */

export interface RenderableObject extends Partial<ObjectListItem> {
  id: number;
  slug: string;
  title: string;
  object_type_slug: string;
  display_title?: string;
  body?: string;
  captured_at?: string;
  edge_count?: number;
  url?: string;
  og_title?: string;
  og_description?: string;
  og_site_name?: string;
  og_image?: string;
  og_favicon?: string;
  status?: string;
  score?: number;
  signal?: string;
  signal_label?: string;
  explanation?: string;
  supporting_signal_labels?: string[];
  pinned_objects?: PinnedBadgeObject[];
  tag_summary?: TagSummary | null;
  [key: string]: unknown;
}

export type ObjectVariant = 'default' | 'module' | 'chip' | 'chain' | 'dock' | 'timeline';

export interface ObjectCardProps {
  object: RenderableObject;
  compact?: boolean;
  variant?: ObjectVariant;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
  /** Called after a successful pin drop (parent slug, child slug). */
  onPinCreated?: (parentSlug: string, childSlug: string) => void;
}

/* ── Fallback card ── */

function FallbackCard({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  return (
    <button
      type="button"
      className="cp-obj cp-obj--fallback"
      data-type={object.object_type_slug}
      data-compact={compact || undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
    >
      <span className="cp-obj-title">{object.display_title ?? object.title}</span>
    </button>
  );
}

/* ── DnD constants ── */

const DND_MIME = 'application/commonplace-object';

/* ── Main dispatcher ── */

export default function ObjectRenderer(props: ObjectCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const { draggedComponent } = useWorkspace();
  const [pointerInside, setPointerInside] = useState(false);
  const isDropTarget = draggedComponent !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [justAttached, setJustAttached] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const color = (e as CustomEvent).detail?.color;
      if (color) {
        setJustAttached(color);
        setTimeout(() => setJustAttached(null), 300);
      }
    };
    el.addEventListener('cp-component-attached', handler);
    return () => el.removeEventListener('cp-component-attached', handler);
  }, []);

  /* Resolve the renderer for this object type */
  const Renderer = OBJECT_RENDERER_REGISTRY[props.object.object_type_slug]?.renderer ?? FallbackCard;
  const compactVariant = props.variant === 'dock' || props.variant === 'chain' || props.variant === 'chip';

  /* Full card with DnD + RoughBorder + tags + pins */
  const card = <Renderer {...props} />;

  const pins = Array.isArray(props.object.pinned_objects) ? props.object.pinned_objects : [];

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(
        DND_MIME,
        JSON.stringify({
          id: props.object.id,
          slug: props.object.slug,
          title: props.object.title,
          object_type: props.object.object_type_slug,
        }),
      );
      e.dataTransfer.effectAllowed = 'link';
      const ghost = document.createElement('div');
      ghost.style.cssText = [
        'padding:4px 10px', 'background:var(--cp-card,rgba(255,255,255,0.85))',
        'border:1px solid var(--cp-border,rgba(42,36,32,0.12))', 'border-radius:4px',
        'font-family:var(--cp-font-body)', 'font-size:12px', 'color:var(--cp-text,#2A2420)',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)', 'max-width:200px',
        'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
        'position:absolute', 'top:-9999px',
      ].join(';');
      ghost.textContent = props.object.title;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 10, 10);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    },
    [props.object.id, props.object.slug, props.object.title, props.object.object_type_slug],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOver(false); }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const raw = e.dataTransfer.getData(DND_MIME);
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as { slug: string };
        if (data.slug === props.object.slug) return;
        props.onPinCreated?.(props.object.slug, data.slug);
        await createPin(props.object.slug, { target_slug: data.slug });
      } catch { /* API error: parent view should refetch */ }
    },
    [props],
  );

  const wrapperClass = [
    'cp-lego-card-wrapper',
    dragOver ? 'cp-drop-target' : '',
    isDropTarget ? 'cp-object-card--receptive' : '',
    isDropTarget && pointerInside ? 'cp-object-card--hover-drop' : '',
    justAttached ? 'cp-object-card--absorbing' : '',
  ].filter(Boolean).join(' ');

  /* Compact variants (dock/chain/chip) skip DnD wrapping */
  if (compactVariant) {
    return <Renderer {...props} />;
  }

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      style={{ position: 'relative', ...(justAttached ? { '--absorb-color': justAttached } : {}) } as React.CSSProperties}
      data-object-id={props.object.id}
      data-object-slug={props.object.slug}
      data-object-type={props.object.object_type_slug}
      data-object-title={props.object.display_title ?? props.object.title}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerEnter={() => isDropTarget && setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      <RoughBorder seed={props.object.slug} glow glowColor="var(--cp-border-faint)">
        {card}
      </RoughBorder>
      <LensAffordance object={props.object} />
      {isDropTarget && pointerInside && (
        <div className="cp-drop-label">Drop to attach component</div>
      )}
      {dragOver && (
        <div className="cp-drop-label" style={{ color: 'var(--cp-accent)' }}>Pin</div>
      )}
      {props.object.tag_summary?.badge && (
        <div className="cp-tag-footer">
          <StatusBadge status={props.object.tag_summary.badge} confirmed={props.object.tag_summary.badge_confirmed} />
          {props.object.tag_summary.pips.length > 0 && <SignalPips pips={props.object.tag_summary.pips} />}
        </div>
      )}
      {pins.length > 0 && (
        <div className="cp-pinned-badges">
          {pins.map((pin) => (
            <PinnedBadge
              key={pin.edge_id}
              object={pin}
              edgeId={pin.edge_id}
              compact
              onClick={props.onClick ? () => props.onClick?.(props.object) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
