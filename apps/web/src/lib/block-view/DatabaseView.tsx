"use client";

/* DatabaseView — the Set surface. Tab bar = the type's saved views (each with
   its own kind), a search box, a sort menu, and New. It queries the object-model
   host, applies the active view, and hands the result to the registry renderer.
   Opening a row raises the object detail. Works for any type: it reads structure
   from the graph, never hardcodes movie/plant. */

import { useMemo, useState } from "react";
import styles from "./database.module.css";
import type { ObjectGraph, SavedView, Sort } from "./database/model";
import { selectObjects } from "./database/model";
import { useDbHost, useObjects } from "./host/useDatabase";
import { renderView } from "./registry";
import { ObjectDetail } from "./renderers/ObjectDetail";
import { IconBoard, IconGallery, IconGrid, IconList, IconPlus, IconSort } from "./renderers/icons";
import type { ViewKind } from "./database/model";

const KIND_ICON: Record<ViewKind, typeof IconGallery> = {
  gallery: IconGallery,
  grid: IconGrid,
  list: IconList,
  board: IconBoard,
};

export function DatabaseView({ graph }: { graph: ObjectGraph }) {
  const host = useDbHost(graph);
  const objects = useObjects(host);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const views = graph.set.views;
  const base: SavedView = views[Math.min(tab, views.length - 1)] ?? { id: "x", name: "All", kind: "gallery", visibleRelations: [], filters: [], sorts: [] };
  const view: SavedView = sort ? { ...base, sorts: [sort] } : base;
  const visible = useMemo(() => selectObjects(objects, view, search), [objects, view, search]);
  const openObject = openId ? host.object(openId) : undefined;

  const create = async () => {
    const res = await host.emit({ kind: "create", type: graph.type.key, props: { title: "Untitled" } });
    const id = res.value?.target_ids?.[0];
    if (id) setOpenId(id);
  };

  const toggleSort = (relationKey: string) => {
    setSort((s) => (s?.relationKey === relationKey ? (s.dir === "asc" ? { relationKey, dir: "desc" } : null) : { relationKey, dir: "asc" }));
    setSortOpen(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.crumb}>Harness / Databases / {graph.set.name}</div>
        <div className={styles.titleRow}>
          {graph.set.emoji && <span className={styles.emoji}>{graph.set.emoji}</span>}
          <h1 className={styles.title}>{graph.set.name}</h1>
        </div>
        {graph.set.description && <p className={styles.sub}>{graph.set.description}</p>}
        <div className={styles.meta}>
          Set · Object type: {graph.type.name} · {objects.length} objects
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {views.map((v, i) => {
            const Icon = KIND_ICON[v.kind] ?? IconGallery;
            return (
              <button
                key={v.id}
                className={`${styles.tab} ${i === tab ? styles.tabActive : ""}`}
                onClick={() => {
                  setTab(i);
                  setSort(null);
                }}
              >
                <Icon />
                {v.name}
              </button>
            );
          })}
        </div>

        <span className={styles.spacer} />

        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "var(--u)" }}>
          <input
            className={styles.search}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={styles.toolBtn} aria-label="Sort" onClick={() => setSortOpen((o) => !o)} data-active={!!sort}>
            <IconSort />
          </button>
          {sortOpen && (
            <div className={styles.sortMenu} role="menu">
              {view.visibleRelations.map((k) => {
                const meta = host.relation(k);
                if (!meta) return null;
                const active = sort?.relationKey === k;
                return (
                  <button key={k} className={styles.sortItem} onClick={() => toggleSort(k)} data-active={active}>
                    {meta.name}
                    {active && <span className={styles.sortDir}>{sort?.dir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button className={styles.newBtn} onClick={create}>
            <IconPlus />
            New
          </button>
        </div>
      </div>

      {renderView(view.kind, { objects: visible, view, host, onOpen: setOpenId })}

      {openObject && <ObjectDetail object={openObject} host={host} onClose={() => setOpenId(null)} />}
    </div>
  );
}
