"use client";

/* The single code-side registry: view kind → renderer component. This is the
   only file that maps arrangement data to component names — everything else is
   data. An unknown kind degrades to the fallback card, never crashes (the
   forward-compat invariant that makes shared/purchased layouts safe). */

import type { ComponentType } from "react";
import styles from "./database.module.css";
import type { ViewKind } from "./database/model";
import { BoardView } from "./renderers/BoardView";
import { GalleryView } from "./renderers/GalleryView";
import { GridView } from "./renderers/GridView";
import { ListView } from "./renderers/ListView";
import type { ViewProps } from "./renderers/types";

export const VIEW_RENDERERS: Readonly<Record<ViewKind, ComponentType<ViewProps>>> = {
  gallery: GalleryView,
  grid: GridView,
  list: ListView,
  board: BoardView,
};

export function FallbackCard({ kind }: { kind: string }) {
  return <div className={styles.fallback}>view kind &quot;{kind}&quot; unavailable — no renderer registered</div>;
}

export function renderView(kind: ViewKind | string, props: ViewProps) {
  const Renderer = (VIEW_RENDERERS as Record<string, ComponentType<ViewProps>>)[kind];
  return Renderer ? <Renderer {...props} /> : <FallbackCard kind={kind} />;
}
