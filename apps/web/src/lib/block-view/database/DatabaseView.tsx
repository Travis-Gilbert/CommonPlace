'use client';

/* DatabaseView — the Set surface over any object type. Saved-view tabs drive the
   active kind (gallery/grid/list/board); search + count in the toolbar; clicking
   an object opens the detail. Pure over an ObjectGraph — the same component
   renders movies, plants, or anything else the object model holds. */
import { useMemo, useState } from 'react';
import { LayoutGrid, Table as TableIcon, List as ListIcon, Columns3, Search } from 'lucide-react';
import type { ObjectGraph, ViewKind } from './model';
import { selectObjects } from './model';
import type { DbViewProps } from './view-types';
import { GalleryView } from './GalleryView';
import { GridView } from './GridView';
import { ListView } from './ListView';
import { BoardView } from './BoardView';
import { ObjectDetail } from './ObjectDetail';
import styles from './database.module.css';

const KIND_ICON: Record<ViewKind, typeof LayoutGrid> = {
  gallery: LayoutGrid,
  grid: TableIcon,
  list: ListIcon,
  board: Columns3,
};

const RENDERER: Record<ViewKind, (props: DbViewProps) => React.JSX.Element> = {
  gallery: GalleryView,
  grid: GridView,
  list: ListView,
  board: BoardView,
};

export function DatabaseView({ graph }: { graph: ObjectGraph }) {
  const views = graph.set.views.length ? graph.set.views : [{ id: 'all', name: 'All', kind: 'gallery' as ViewKind, visibleRelations: Object.keys(graph.relations), filters: [], sorts: [] }];
  const [activeId, setActiveId] = useState(views[0].id);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const view = views.find((v) => v.id === activeId) ?? views[0];
  const objects = useMemo(() => selectObjects(graph.objects, view, search), [graph.objects, view, search]);
  const selected = selectedId ? graph.objects.find((o) => o.id === selectedId) : undefined;

  if (selected) {
    return (
      <div className={styles.wrap}>
        <ObjectDetail graph={graph} object={selected} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  const Renderer = RENDERER[view.kind];

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Set · Object type: {graph.type.name}</span>
        <h1 className={styles.title}>
          {graph.set.emoji && <span className={styles.titleEmoji}>{graph.set.emoji}</span>}
          {graph.set.name}
        </h1>
        {graph.set.description && <p className={styles.subtitle}>{graph.set.description}</p>}
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {views.map((v) => {
            const Icon = KIND_ICON[v.kind];
            return (
              <button key={v.id} type="button" className={styles.tab} data-active={v.id === activeId} onClick={() => setActiveId(v.id)}>
                <Icon size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                {v.name}
              </button>
            );
          })}
        </div>
        <div className={styles.tools}>
          <span className={styles.count}>{objects.length}</span>
          <label className={styles.search}>
            <Search size={13} />
            <input
              className={styles.searchInput}
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      <Renderer graph={graph} objects={objects} view={view} onOpen={setSelectedId} />
    </div>
  );
}
