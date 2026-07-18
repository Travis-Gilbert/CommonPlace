'use client';

// SOURCING: @commonplace/block-view (host query/emit over the object
// contract). The doc.list descriptor (R3.2): the Documents surface's left
// tool window, a live query over document-kind atoms at Twenty density.
// Selecting a document retargets the active surface's markdown.doc reader by
// patching that view instance's query through the host: navigation is an
// arrangement edit, not component state.

import { useMemo } from 'react';
import type { JsonValue, ObjectRef, ViewRenderProps } from '@commonplace/block-view/types';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import { ViewState } from './ViewStates';
import { IconDoc, KindDot } from '@/components/shell/icons';

export function DocListView({ set, host }: ViewRenderProps) {
  const docs = useMemo(
    () =>
      [...set.objects].sort((a, b) =>
        String(a.properties.title ?? '').localeCompare(String(b.properties.title ?? '')),
      ),
    [set],
  );

  const openDoc = async (doc: ObjectRef) => {
    const layout = await Promise.resolve(host.query(surfaceQuery()));
    const byId = new Map(layout.objects.map((object) => [object.id, object]));
    const activeSurface = layout.objects.find(
      (object) => object.type === 'surface' && object.properties.active === true,
    );
    const editorRegion = (activeSurface?.relations?.CONTAINS ?? [])
      .map((id) => byId.get(id))
      .find((region) => region?.properties.kind === 'editor');
    const readerId = (editorRegion?.relations?.CONTAINS ?? []).find(
      (id) => byId.get(id)?.properties.descriptor_id === 'markdown.doc',
    );
    if (!editorRegion || !readerId) return;
    void host.emit({
      kind: 'update',
      id: readerId,
      patch: {
        title: String(doc.properties.title ?? doc.id),
        query: {
          types: ['doc'],
          where: { kind: 'eq', field: 'slug', value: doc.properties.slug ?? doc.id },
        } as unknown as JsonValue,
      },
    });
    void host.emit({ kind: 'update', id: editorRegion.id, patch: { active_tab: readerId } });
  };

  if (docs.length === 0) return <ViewState state="empty" />;

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Documents">
      {docs.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            data-doc-id={doc.id}
            onClick={() => void openDoc(doc)}
            className="flex h-8 w-full items-center gap-2 overflow-hidden border-b border-ij-seam px-rec-cell-pad text-left text-ij-ink hover:bg-ij-hover-surface"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            <IconDoc size={14} className="shrink-0 text-ij-ink-info" />
            <KindDot kind="doc" />
            <span className="truncate">{String(doc.properties.title ?? doc.id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The index.rail descriptor (R3.1): the destination rail names its missing
 *  wire honestly; connectors and the filing engine are out of scope this
 *  round, so no destination data exists to render. */
export function IndexRailView(_props: ViewRenderProps) {
  return (
    <ViewState
      state="unavailable"
      capability="destinations (connectors and the filing engine, out of scope this round)"
    />
  );
}
